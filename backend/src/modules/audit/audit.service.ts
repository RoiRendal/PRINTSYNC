import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../shared/errors.js';

export interface AuditLogRecord {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface ListAuditLogsInput {
  page: number;
  pageSize: number;
  action?: string | undefined;
  entityType?: string | undefined;
}

interface ListAuditLogsResult {
  items: AuditLogRecord[];
  page: number;
  pageSize: number;
  total: number;
}

export async function listAuditLogs(
  supabase: SupabaseClient,
  input: ListAuditLogsInput,
): Promise<ListAuditLogsResult> {
  const start = (input.page - 1) * input.pageSize;
  const end = start + input.pageSize - 1;
  let query = supabase
    .from('audit_logs')
    .select('id, actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(start, end);

  if (input.action) query = query.eq('action', input.action);
  if (input.entityType) query = query.eq('entity_type', input.entityType);

  const { data, error, count } = await query;
  if (error) throw new AppError(503, 'AUDIT_LOG_LOOKUP_FAILED', 'Audit logs could not be loaded.');

  return {
    items: data.map((entry) => ({
      id: entry.id,
      actorId: entry.actor_id,
      action: entry.action,
      entityType: entry.entity_type,
      entityId: entry.entity_id,
      metadata: (entry.metadata as Record<string, unknown> | null) ?? {},
      ipAddress: entry.ip_address,
      userAgent: entry.user_agent,
      createdAt: entry.created_at,
    })),
    page: input.page,
    pageSize: input.pageSize,
    total: count ?? 0,
  };
}