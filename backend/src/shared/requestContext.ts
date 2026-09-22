import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * The facts about the request currently being served.
 *
 * ### Why this is ambient state rather than a parameter
 *
 * A request id is only worth having if it is on *every* line that describes the
 * request — including the ones written from deep inside a service, and above all
 * the ones written on the error path, where the id is the only thing that ties a
 * stack trace back to the request that caused it. Threading it through as an
 * argument would mean editing every service signature and every log call, and the
 * calls that get forgotten would be exactly the interesting ones.
 *
 * `AsyncLocalStorage` makes the context follow the async call chain instead, so a
 * service can ask "what request am I serving?" without being told. That is the
 * right shape for these three fields: they describe the *request*, not the
 * operation, and an operation's signature should not grow a parameter every time
 * we decide to record one more of them.
 *
 * The trade-off is real and worth naming: a reader of `orders.service.ts` cannot
 * see from its signature that it depends on a request context. So the dependency
 * is documented at each use site, and the accessors are deliberately cheap and
 * total — they never throw, and they never invent a value.
 *
 * Outside a request — unit tests, `provisionUser`, `seedDemoData` — there is no
 * store and every accessor answers `undefined`/`null`. That is the correct answer
 * for those callers, and it keeps them working unchanged.
 */
export interface RequestContext {
  /** The id echoed back to the client in `x-request-id`. Never empty. */
  requestId: string;
  /**
   * The client address, meaningful only because `app.ts` sets `trust proxy`.
   *
   * Kept as the raw string rather than validated here: the database column is
   * `inet` and is the thing that should decide whether it is an address. See the
   * safe cast in `write_audit_log` — a malformed value must degrade the audit row,
   * never fail the action it describes.
   */
  ipAddress: string | null;
  userAgent: string | null;
}

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * Runs `callback` — and everything it awaits — with `context` attached.
 *
 * The callback style is not decoration. `AsyncLocalStorage.run` restores the
 * previous store when its callback returns, so the value has to still be running
 * when the request is handled: `run(ctx, next)` hands the store to the rest of
 * the middleware chain and to the route handler behind it.
 */
export function runWithRequestContext<T>(context: RequestContext, callback: () => T): T {
  return storage.run(context, callback);
}

/** The context for the request being served, or `undefined` outside one. */
export function currentRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/** The current request id, or `null` outside a request. */
export function currentRequestId(): string | null {
  return storage.getStore()?.requestId ?? null;
}

/**
 * The trailing arguments the money RPCs take so they can write their own audit
 * row: `create_transaction_with_payment`, `void_transaction`,
 * `create_order_with_items`, `replace_order_with_items` and
 * `delete_order_with_items` all end with these three.
 *
 * One function rather than three reads at each call site, because the argument
 * names have to match the SQL exactly and a typo in one of five copies would
 * surface as a *missing argument* error at runtime rather than a compile error.
 *
 * Returning `null`s outside a request is deliberate and correct: the row is still
 * written, with no request to attribute it to. See `provisionUser` and the
 * seeder, which run without one.
 */
export function auditRpcArguments(): {
  p_audit_request_id: string | null;
  p_audit_ip_address: string | null;
  p_audit_user_agent: string | null;
} {
  const context = currentRequestContext();
  return {
    p_audit_request_id: context?.requestId ?? null,
    p_audit_ip_address: context?.ipAddress ?? null,
    p_audit_user_agent: context?.userAgent ?? null,
  };
}
