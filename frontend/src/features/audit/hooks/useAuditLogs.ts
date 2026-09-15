import { useCallback, useEffect, useState } from 'react';
import { auditApi } from '../api/auditApi';
import type { AuditLogListResult, AuditLogRecord } from '../types';

export function useAuditLogs() {
  const [result, setResult] = useState<AuditLogListResult | null>(null);
  const [items, setItems] = useState<AuditLogRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await auditApi.list({
        page,
        pageSize,
        action: actionFilter || undefined,
        entityType: entityTypeFilter || undefined,
      });
      setResult(data);
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Audit logs could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, actionFilter, entityTypeFilter]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const totalPages = result ? Math.ceil(result.total / result.pageSize) : 0;

  return {
    items,
    isLoading,
    error,
    page,
    pageSize,
    total: result?.total ?? 0,
    totalPages,
    actionFilter,
    entityTypeFilter,
    setPage,
    setPageSize,
    setActionFilter,
    setEntityTypeFilter,
    refresh: fetchLogs,
  };
}
