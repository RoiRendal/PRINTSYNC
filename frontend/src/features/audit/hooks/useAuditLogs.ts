import { useCallback, useEffect, useRef, useState } from 'react';
import { auditApi } from '../api/auditApi';
import { subscribeToDataChanges } from '../../../shared/store/dataEvents';
import type { AuditLogListResult, AuditLogRecord } from '../types';

/** Coalesces a burst of mutations into one refetch. */
const AUDIT_RELOAD_DEBOUNCE_MS = 400;

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

  /*
   * Nearly every privileged action writes an audit row, so any announced change
   * means this page may already be out of date. Rather than map each domain to
   * the audit actions it produces, a single debounced refetch covers all of
   * them — this is an admin-only, low-traffic screen, so the extra call is
   * cheaper than the mapping would be to maintain.
   */
  const reloadTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToDataChanges(() => {
      if (reloadTimerRef.current !== null) window.clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = window.setTimeout(() => {
        reloadTimerRef.current = null;
        void fetchLogs();
      }, AUDIT_RELOAD_DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (reloadTimerRef.current !== null) {
        window.clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
    };
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
