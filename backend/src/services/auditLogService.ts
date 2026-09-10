import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../shared/errors.js';

interface AuditLogInput {
  actorId?: string | null | undefined;
  action: string;
  entityType: string;
  entityId?: string | null | undefined;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
}

export async function writeAuditLog(supabase: SupabaseClient, input: AuditLogInput): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert({
    actor_id: input.actorId ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
  });

  if (error) {
    throw new AppError(503, 'AUDIT_LOG_WRITE_FAILED', 'The audit event could not be recorded.');
  }
}