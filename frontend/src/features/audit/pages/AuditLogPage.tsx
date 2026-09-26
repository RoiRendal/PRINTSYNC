import { useMemo, useState } from 'react';
import { RefreshCw, Search, ScrollText } from 'lucide-react';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Pagination,
  Select,
  StatusLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../shared/components/ui';
import type { BadgeVariant } from '../../../shared/components/ui';
import { cn } from '../../../shared/lib/cn';
import { useAuditLogs } from '../hooks/useAuditLogs';

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'order.created', label: 'Order Created' },
  { value: 'order.updated', label: 'Order Updated' },
  { value: 'order.deleted', label: 'Order Deleted' },
  { value: 'inventory.created', label: 'Inventory Created' },
  { value: 'inventory.updated', label: 'Inventory Updated' },
  { value: 'inventory.deleted', label: 'Inventory Deleted' },
  { value: 'transaction.voided', label: 'Transaction Voided' },
  { value: 'user.created', label: 'User Created' },
  { value: 'user.updated', label: 'User Updated' },
  { value: 'user.deleted', label: 'User Deleted' },
  { value: 'settings.business_updated', label: 'Settings Updated' },
  { value: 'customer.created', label: 'Customer Created' },
  { value: 'customer.updated', label: 'Customer Updated' },
  { value: 'customer.deleted', label: 'Customer Deleted' },
];

const ENTITY_OPTIONS = [
  { value: '', label: 'All Entities' },
  { value: 'order', label: 'Order' },
  { value: 'inventory_item', label: 'Inventory Item' },
  { value: 'sales_transaction', label: 'Transaction' },
  { value: 'user', label: 'User' },
  { value: 'business_settings', label: 'Business Settings' },
  { value: 'customer', label: 'Customer' },
];

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function formatAction(action: string): string {
  return action
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * `BadgeVariant` is the only valid set of values — the previous local union
 * declared `'default'` and `'yellow'`, neither of which exists. `StatusLabel`
 * looks its tone up in a record, so an unknown value resolved to `undefined` and
 * the dot rendered with no colour at all. Typing the variable as `BadgeVariant`
 * makes that class of mistake a compile error.
 */
function ActionBadge({ action }: { action: string }) {
  let variant: BadgeVariant = 'neutral';
  if (action.includes('.created')) variant = 'green';
  else if (action.includes('.updated')) variant = 'blue';
  else if (action.includes('.deleted') || action.includes('.voided')) variant = 'red';
  else if (action.includes('settings')) variant = 'purple';
  return <StatusLabel tone={variant}>{formatAction(action)}</StatusLabel>;
}

function MetadataPreview({ metadata }: { metadata: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const entries = Object.entries(metadata);
  if (entries.length === 0) return <span className="text-macos-text-muted dark:text-zinc-500">—</span>;

  const preview = entries.slice(0, 2).map(([k, v]) => `${k}: ${String(v).slice(0, 20)}`).join(', ');

  return (
    <button
      type="button"
      onClick={() => setExpanded(!expanded)}
      className="text-left text-macos-text-muted hover:text-macos-blue dark:text-zinc-400 dark:hover:text-macos-cyan"
    >
      {expanded ? (
        <pre className="max-w-xs whitespace-pre-wrap break-words rounded-md bg-[#f2f2f2] p-2 dark:bg-[#373739]">
          {JSON.stringify(metadata, null, 2)}
        </pre>
      ) : (
        <span className="truncate">{preview}{entries.length > 2 && '...'}</span>
      )}
    </button>
  );
}

export default function AuditLogPage() {
  const {
    items,
    isLoading,
    error,
    page,
    pageSize,
    total,
    totalPages,
    actionFilter,
    entityTypeFilter,
    setPage,
    setActionFilter,
    setEntityTypeFilter,
    refresh,
  } = useAuditLogs();

  const [search, setSearch] = useState('');

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((log) => {
      return (
        log.action.toLowerCase().includes(query) ||
        log.entityType.toLowerCase().includes(query) ||
        (log.actorId ?? '').toLowerCase().includes(query) ||
        (log.entityId ?? '').toLowerCase().includes(query)
      );
    });
  }, [items, search]);

  if (isLoading && items.length === 0) return <LoadingState label="Loading audit logs" className="min-h-64" />;
  if (error) return <ErrorState message={error} onRetry={refresh} className="min-h-64" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-macos-text dark:text-zinc-100 lg:text-[28px]">Audit Log</h1>
          <p className="mt-1 text-sm text-macos-text-muted dark:text-zinc-400">
            Review system activity, who changed what, and when.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => refresh()} leftIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}>
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="space-y-3 lg:col-span-1">
          <Card variant="raised" padding="lg">
            <CardHeader>
              <CardTitle className="label-caps">Activity Overview</CardTitle>
              <CardDescription>Summary of tracked events.</CardDescription>
            </CardHeader>
            <div className="space-y-2.5">
              {[
                { label: 'Total Events', value: total, tone: 'blue' as const },
                { label: 'Current Page', value: `${page} / ${totalPages || 1}`, tone: 'purple' as const },
                { label: 'Shown', value: items.length, tone: 'green' as const },
              ].map(({ label, value, tone }) => (
                <div key={label} className="flex items-center justify-between rounded-[var(--radius-card)] border p-3">
                  <div className="flex items-center gap-2.5">
                    <span className={cn('flex h-8 w-8 items-center justify-center rounded-[0.75rem]', tone === 'purple' && 'bg-[var(--app-tint-purple)] text-macos-purple', tone === 'blue' && 'bg-[var(--app-tint-blue)] text-macos-blue dark:text-macos-cyan', tone === 'green' && 'bg-[var(--app-tint-green)] text-green-700 dark:text-green-300')}>
                      <ScrollText className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="text-[10px] font-bold text-macos-text-muted dark:text-zinc-400">{label}</span>
                  </div>
                  <span className="font-mono text-sm font-bold text-macos-text dark:text-zinc-100">{value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-3 lg:col-span-3">
          <Card padding="none" className="overflow-hidden">
            <CardHeader className="mb-0 flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-end">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-macos-text-muted dark:text-zinc-500" aria-hidden="true" />
                  <Input className="pl-9 text-xs" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search events..." />
                </div>
                <div className="flex gap-2">
                  <Select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}>
                    {ACTION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </Select>
                  <Select value={entityTypeFilter} onChange={(e) => { setEntityTypeFilter(e.target.value); setPage(1); }}>
                    {ENTITY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <TableContainer className="rounded-none border-0 bg-transparent">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[160px]">Timestamp</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-macos-text-muted dark:text-zinc-500">
                          {formatTimestamp(log.createdAt)}
                        </TableCell>
                        <TableCell>
                          <ActionBadge action={log.action} />
                        </TableCell>
                        <TableCell>
                          <span className="text-macos-text dark:text-zinc-200">
                            {log.entityType.replace(/_/g, ' ')}
                          </span>
                          {log.entityId && (
                            <span className="ml-1.5 text-macos-text-muted dark:text-zinc-500">
                              {log.entityId.slice(0, 8)}...
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-macos-text dark:text-zinc-200">
                          {log.actorId ? log.actorId.slice(0, 8) + '...' : 'System'}
                        </TableCell>
                        <TableCell>
                          <MetadataPreview metadata={log.metadata} />
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredItems.length === 0 && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={5} className="py-10 text-center text-sm text-macos-text-muted dark:text-zinc-500">
                          No audit events match your filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <div className="space-y-2 border-t px-4 py-3">
                <span className="block text-macos-text-muted dark:text-zinc-500">
                  Showing {items.length} of {total} events
                </span>
                <Pagination page={page} limit={pageSize} total={total} onPageChange={setPage} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
