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

export interface AuditLogListResult {
  items: AuditLogRecord[];
  page: number;
  pageSize: number;
  total: number;
}

export type AuditLogAction =
  | 'order.created'
  | 'order.updated'
  | 'order.deleted'
  | 'inventory.created'
  | 'inventory.updated'
  | 'inventory.deleted'
  | 'transaction.voided'
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'settings.business_updated'
  | 'customer.created'
  | 'customer.updated'
  | 'customer.deleted'
  | string;

export type AuditLogEntityType =
  | 'order'
  | 'inventory_item'
  | 'sales_transaction'
  | 'user'
  | 'business_settings'
  | 'customer'
  | string;
