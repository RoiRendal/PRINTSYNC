import type { SupabaseClient } from '@supabase/supabase-js';

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
    console.error('Audit log write failed', {
      code: error.code,
      message: error.message,
      details: error.details,
    });
    return false;
  }

  return true;
}