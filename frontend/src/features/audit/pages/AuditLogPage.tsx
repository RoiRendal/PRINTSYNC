import { useMemo, useState } from 'react';
import { RefreshCw } from '../../../shared/components/ui/icons';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { TableSkeleton } from '../../../shared/components/feedback/TableSkeleton';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Pagination,
  SearchInput,
  Select,
  StatTile,
  StatTileRow,
  StatusLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  cellTitle,
} from '../../../shared/components/ui';
import type { BadgeVariant } from '../../../shared/components/ui';
import { TOOLBAR_ROW_CLASS, TOOLBAR_SEARCH_WIDTH_CLASS } from '../../../shared/lib/toolbar';
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
 * the label rendered with no colour at all. Typing the variable as `BadgeVariant`
 * makes that class of mistake a compile error.
 */
function ActionBadge({ action }: { action: string }) {
  let variant: BadgeVariant = 'neutral';
  if (action.includes('.created')) variant = 'green';
  else if (action.includes('.updated')) variant = 'accent';
  else if (action.includes('.deleted') || action.includes('.voided')) variant = 'red';
  else if (action.includes('settings')) variant = 'purple';
  return <StatusLabel tone={variant}>{formatAction(action)}</StatusLabel>;
}

/**
 * The whole metadata record as ONE flat string: `"key: value"` pairs, comma
 * joined, nothing cut short.
 *
 * This replaces `MetadataPreview`, which was a button that expanded the row into
 * a pretty-printed JSON block. That block was the last thing in any table that
 * could make a row many lines tall, which is precisely what the one-line rule
 * forbids — a row that grows on click is a row that is not one line. So the
 * expansion is gone and the full string travels in the cell's tooltip instead:
 * the value is still reachable, the row stays flat, and nothing about it depends
 * on the user knowing it can be clicked.
 *
 * The old component also hand-wrote its own clipping — the first two entries
 * only, each value cut at 20 characters, with a hand-typed ellipsis appended.
 * The browser draws the ellipsis now, so none of that is needed, and it was
 * actively hiding data that a full value would have shown.
 */
function formatMetadata(metadata: Record<string, unknown>): string {
  return Object.entries(metadata)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(', ');
}

export default function AuditLogPage() {
  const {
    items,
    isLoading,
    error,
    page,
    pageSize,
    total,
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

  /* Audit Log is the one list table with no checkbox column — nothing in the log
     is deletable — so the skeleton drops the select column with it. */
  if (isLoading && items.length === 0) return <TableSkeleton columns={5} select={false} className="min-h-64" />;
  if (error) return <ErrorState message={error} onRetry={refresh} className="min-h-64" />;

  return (
    <div className="space-y-5">
      <StatTileRow columns={1}>
        <StatTile label="Total Events" value={total} />
      </StatTileRow>

      <Card padding="none" className="overflow-hidden">
            <CardHeader className="mb-0 flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-end">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {/*
                  Search and Refresh are one group, then the two filters — the
                  refresh sits on the right of the search box, the position this
                  page's toolbar controls take. It is disabled while a load is in
                  flight because, unlike the other list tables whose whole toolbar
                  is replaced by a skeleton, this header stays on screen: the
                  button is the only thing that can report that a fetch is running.

                  The wrapper is the shared toolbar row now. It used to be a bare
                  `flex w-full gap-2` with a `sm:max-w-xs` cap and no `sm:flex-row`
                  — so on a mid-width screen the search box and Refresh stacked
                  into two rows instead of sitting side by side, while every other
                  table's toolbar stayed one row.
                */}
                <div className={TOOLBAR_ROW_CLASS}>
                  <SearchInput className={TOOLBAR_SEARCH_WIDTH_CLASS} value={search} onChange={(e) => setSearch(e.target.value)} />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    disabled={isLoading}
                    onClick={() => refresh()}
                    aria-label="Refresh"
                    title="Refresh"
                    className="shrink-0"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
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
                  {/*
                    Details is the column that used to wrap — it takes whatever is
                    left after the four fixed ones, so it stays the widest and the
                    row stays one line.
                  */}
                  <colgroup>
                    <col style={{ width: '160px' }} />
                    <col style={{ width: '130px' }} />
                    <col style={{ width: '150px' }} />
                    <col style={{ width: '140px' }} />
                    <col style={{ width: '320px' }} />
                  </colgroup>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((log) => {
                      /*
                        Entity and Actor used to be truncated to their first
                        eight characters by hand, with a hand-typed ellipsis.
                        That was a workaround from before cells could clip. Now
                        the whole identifier is rendered, the browser clips it,
                        and the tooltip carries it in full — so an operator can
                        actually copy a complete reference off the row.
                      */
                      const entityLabel = log.entityType.replace(/_/g, ' ');
                      const entityText = log.entityId ? `${entityLabel} ${log.entityId}` : entityLabel;
                      const actorText = log.actorId || 'System';
                      const details = formatMetadata(log.metadata);
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="text-app-text-muted dark:text-zinc-500" title={cellTitle('Timestamp', formatTimestamp(log.createdAt))}>
                            {formatTimestamp(log.createdAt)}
                          </TableCell>
                          <TableCell title={cellTitle('Action', formatAction(log.action))}>
                            <ActionBadge action={log.action} />
                          </TableCell>
                          <TableCell title={cellTitle('Entity', entityText)}>
                            <span className="text-app-ink dark:text-zinc-200">
                              {entityLabel}
                            </span>
                            {log.entityId && (
                              <span className="ml-1.5 text-app-text-muted dark:text-zinc-500">
                                {log.entityId}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-app-ink dark:text-zinc-200" title={cellTitle('Actor', actorText)}>
                            {actorText}
                          </TableCell>
                          <TableCell title={cellTitle('Details', details)}>
                            {details ? (
                              <span className="text-app-text-muted dark:text-zinc-400">{details}</span>
                            ) : (
                              <span className="text-app-text-muted dark:text-zinc-500">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredItems.length === 0 && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={5} className="whitespace-normal py-10 text-center text-sm text-app-text-muted dark:text-zinc-500">
                          No audit events match your filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/*
                The footer is the pagination band alone, and only when there is
                more than one page — the same shape every other list table ends
                in. The "Showing N of M events" line above the pager was the last
                one left in the app, and the pager already reports "(N total)".
              */}
              {total > pageSize && (
                <div className="border-t px-4 py-3">
                  <Pagination page={page} limit={pageSize} total={total} onPageChange={setPage} />
                </div>
              )}
            </CardContent>
          </Card>
    </div>
  );
}
