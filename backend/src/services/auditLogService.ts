import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../shared/logger.js';

interface AuditLogInput {
  actorId?: string | null | undefined;
  action: string;
  entityType: string;
  entityId?: string | null | undefined;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
}

export async function writeAuditLog(supabase: SupabaseClient, input: AuditLogInput): Promise<boolean> {
  const { error } = await supabase.rpc('write_audit_log', {
    p_actor_id: input.actorId ?? null,
    p_action: input.action,
    p_entity_type: input.entityType,
    p_entity_id: input.entityId ?? null,
    p_metadata: input.metadata ?? {},
    p_ip_address: input.ipAddress ?? null,
    p_user_agent: input.userAgent ?? null,
  });

  if (error) {
    logger.warn('Audit log write failed', {
      code: error.code,
      message: error.message,
      action: input.action,
      entityType: input.entityType,
    });
    return false;
  }

  return true;
}