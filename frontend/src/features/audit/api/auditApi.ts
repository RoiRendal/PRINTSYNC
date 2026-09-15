import { apiClient, type ApiClient } from '../../../shared/api/client';
import type { AuditLogListResult } from '../types';

export interface AuditLogQuery {
  page?: number;
  pageSize?: number;
  action?: string;
  entityType?: string;
}

export function createAuditApi(client: ApiClient = apiClient) {
  return {
    list: (query: AuditLogQuery = {}) => {
      const params = new URLSearchParams();
      if (query.page) params.set('page', String(query.page));
      if (query.pageSize) params.set('pageSize', String(query.pageSize));
      if (query.action) params.set('action', query.action);
      if (query.entityType) params.set('entityType', query.entityType);
      const queryString = params.toString();
      return client.get<AuditLogListResult>(`/audit${queryString ? `?${queryString}` : ''}`);
    },
  };
}

export const auditApi = createAuditApi();
