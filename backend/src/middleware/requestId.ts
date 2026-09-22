import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { runWithRequestContext } from '../shared/requestContext.js';

/** The header this middleware reads and writes. */
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Longest client-supplied id we will accept.
 *
 * A UUID is 36 characters. The ceiling exists so a client cannot push an
 * arbitrary blob into `audit_logs.metadata` or into every log line for the
 * request by way of a header.
 */
const MAX_REQUEST_ID_LENGTH = 128;

/**
 * What a client-supplied id may contain: printable ASCII, nothing else.
 *
 * This is a security check, not a formatting preference. The value is echoed
 * into JSON log lines and into the audit row, so a newline in it could forge a
 * second log entry, and a control character could corrupt whatever reads the
 * output. Restricting the alphabet to printable ASCII removes both without
 * costing anything real — every tracing tool already emits ids in this range.
 */
const ACCEPTABLE_REQUEST_ID = /^[\x20-\x7e]+$/;

/**
 * Uses the caller's `x-request-id` when it is plausible, and mints one when it is
 * not.
 *
 * Accepting the caller's id is what makes the header worth having: the frontend,
 * a load balancer or a support script can start a trace and follow it into the
 * API. It is trusted only as a *label* — nothing is looked up by it, and it
 * cannot influence authorization, so an invented value is harmless. It is still
 * validated, because it is written to places (logs, audit metadata) where a
 * hostile value would matter.
 *
 * A malformed or oversized id is replaced rather than rejected: a bad tracing
 * header should not fail a checkout.
 */
function resolveRequestId(request: Request): string {
  const supplied = request.get(REQUEST_ID_HEADER);
  if (typeof supplied === 'string') {
    const candidate = supplied.trim();
    if (candidate.length > 0 && candidate.length <= MAX_REQUEST_ID_LENGTH && ACCEPTABLE_REQUEST_ID.test(candidate)) {
      return candidate;
    }
  }
  return randomUUID();
}

/**
 * The client address, or `null` when it is not an address.
 *
 * `audit_logs.ip_address` is `inet`, and the audit row is now written *inside* the
 * money transaction — so a value Postgres refused to cast would not merely lose
 * the address, it would roll back the sale. Validating here means that can never
 * happen, and it costs nothing: `isIP` is a string check.
 *
 * It is not a hypothetical. `trust proxy` is set to `1` because Render is the only
 * thing that ever fronts this process (see `app.ts`). If the service were ever
 * exposed directly, `request.ip` would be whatever the client put in
 * `X-Forwarded-For` — and a forged header must not be able to stop a cashier from
 * completing a sale. A missing address in an audit row is a small loss; a failed
 * checkout is not.
 *
 * `isIP` accepts the IPv6 forms Express actually produces, including the
 * IPv4-mapped `::ffff:203.0.113.7`, and returns `0` for anything else.
 */
function resolveIpAddress(request: Request): string | null {
  const address = request.ip;
  return typeof address === 'string' && isIP(address) !== 0 ? address : null;
}

/**
 * Establishes the request id and the rest of the request context.
 *
 * ### Registered first, before every other middleware
 *
 * Two reasons, both about coverage:
 *
 *   - Anything that can log — helmet, cors, the body parsers, the rate limiters —
 *     must already have a context, or its log lines are the ones without an id.
 *   - The response header must be set before anything can start a response. A
 *     rejected request still deserves an id the caller can quote.
 *
 * ### `request.ip` is read here, not later
 *
 * It is stable for the life of the request, and reading it once keeps the "where
 * did this come from" question in one place. It is only a real client address
 * because `app.ts` sets `trust proxy`; see the note there.
 */
export const requestId: RequestHandler = (request: Request, response: Response, next: NextFunction) => {
  const id = resolveRequestId(request);

  response.setHeader(REQUEST_ID_HEADER, id);

  runWithRequestContext(
    {
      requestId: id,
      ipAddress: resolveIpAddress(request),
      userAgent: request.get('user-agent') ?? null,
    },
    next,
  );
};
