// The audit-log record and its list result are the shared contract; re-export them
// so the viewer and the API cannot drift. The action/entity unions are frontend-only
// (they widen to `string` because the API may emit codes this client does not know).
import type { AuditLogRecord, ListAuditLogsResult } from '@printsync/shared-types';

export type { AuditLogRecord, ListAuditLogsResult };

export type AuditLogListResult = ListAuditLogsResult;

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
