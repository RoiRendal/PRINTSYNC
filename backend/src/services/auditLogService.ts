import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../shared/errors.js';
import { logger } from '../shared/logger.js';
import { currentRequestContext } from '../shared/requestContext.js';

interface AuditLogInput {
  actorId?: string | null | undefined;
  action: string;
  entityType: string;
  entityId?: string | null | undefined;
  metadata?: Record<string, unknown>;
  /**
   * All three default to the current request's values. Pass them explicitly only
   * to override that — for a row written about something other than the request
   * being served, which no caller currently does.
   */
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
  requestId?: string | null | undefined;
}

/**
 * Records one audit row.
 *
 * ### The request context supplies what callers used to omit
 *
 * Before this, `ip_address` and `user_agent` were passed by `auth.routes.ts` and
 * `users.routes.ts` and by nothing else — so every money action (orders,
 * payments, order payments) wrote an audit row with no address and no client
 * string, even after `trust proxy` was fixed to make those fields meaningful.
 * Defaulting them from the request context means a caller can no longer produce a
 * thin row by forgetting, and the routes that already passed them keep working
 * unchanged.
 *
 * `requestId` has no other source: it only ever comes from the context, and it is
 * merged into `metadata` by `write_audit_log` so the column set stays as it is.
 *
 * ### A failure is raised, not swallowed
 *
 * This used to log a warning and return `false`, and every caller ignored the
 * return value — so a lost audit row was invisible. The audit log is the only
 * record that a hard delete happened, because there is no soft delete anywhere in
 * this schema.
 *
 * The trade-off, stated plainly. The money actions no longer come through here:
 * their RPC writes the row inside its own transaction, so a failure rolls the
 * action back. Every other caller writes this row *after* its action has already
 * committed, so a 500 raised here means "the action happened and is not recorded"
 * — the client is told a failure occurred for work that was in fact done. That is
 * still the better failure: it is loud, it is immediate, and the table shows what
 * happened. A silently missing audit row is none of those.
 *
 * The durable fix for those callers is an RPC of their own, which is why this is
 * the short-term hardening rather than the answer.
 */
export async function writeAuditLog(supabase: SupabaseClient, input: AuditLogInput): Promise<void> {
  const context = currentRequestContext();

  const { error } = await supabase.rpc('write_audit_log', {
    p_actor_id: input.actorId ?? null,
    p_action: input.action,
    p_entity_type: input.entityType,
    p_entity_id: input.entityId ?? null,
    p_metadata: input.metadata ?? {},
    p_ip_address: input.ipAddress ?? context?.ipAddress ?? null,
    p_user_agent: input.userAgent ?? context?.userAgent ?? null,
    p_request_id: input.requestId ?? context?.requestId ?? null,
  });

  if (error) {
    logger.error('Audit log write failed', {
      code: error.code,
      message: error.message,
      action: input.action,
      entityType: input.entityType,
    });
    throw new AppError(500, 'AUDIT_WRITE_FAILED', 'The action could not be recorded in the audit log.');
  }
}
