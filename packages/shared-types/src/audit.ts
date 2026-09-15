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

export interface ListAuditLogsParams {
  page: number;
  pageSize: number;
  action?: string;
  entityType?: string;
}

export interface ListAuditLogsResult {
  items: AuditLogRecord[];
  page: number;
  pageSize: number;
  total: number;
}
