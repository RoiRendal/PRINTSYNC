import { ChevronLeft, ChevronRight, Edit3, LoaderCircle, Search, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Input,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableSelectCell,
  TableSelectHead,
  getStatusBadgeVariant,
} from '../../../../shared/components/ui';
import { formatSelectedCount } from '../../../../shared/lib/selectionLabels';
import { useBusinessBranding } from '../../../../app/providers/BusinessBrandingProvider';
import type { RowSelection } from '../../../../shared/hooks/useRowSelection';
import type { Order } from '../../types';
import { isCustomOrder } from '../../utils/orderType';
import { PhaseProgress, workPhases } from './PhaseProgress';

interface OrdersTableProps {
  orders: Order[];
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSelectOrder: (order: Order) => void;
  onEditOrder: (order: Order) => void;
  /**
   * Deletes every ticked row. The table no longer deletes one row at a time: the
   * row's trash button was removed so a delete can only come from the header
   * control, which is the one place that can state how many rows it will take.
   */
  onDeleteSelected: () => void;
  /** Tick state, owned by the page. See `useRowSelection`. */
  selection: RowSelection;
  onAdvancePhase: (order: Order, direction: -1 | 1) => void;
  /**
   * Orders whose phase move has been sent but not yet answered.
   *
   * Required rather than optional on purpose: a caller that forgot to pass it
   * would silently lose the guard, and the guard is what stops a second click on
   * the same row from being refused by the server as a conflict with the user's
   * own first click.
   */
  pendingOrderIds: ReadonlySet<string>;
}

export function OrdersTable({
  orders,
  searchTerm,
  onSearchTermChange,
  onSelectOrder,
  onEditOrder,
  onDeleteSelected,
  selection,
  onAdvancePhase,
  pendingOrderIds,
}: OrdersTableProps) {
  const { currencySymbol } = useBusinessBranding();
  return (
    <Card padding="none" className="overflow-hidden">
      {/*
        No title or description: the toolbar sits flush against the top edge of
        the card so the table reads as a list, not a labelled section. The
        delete control is now an icon-only square, gray like Cancel, and the
        header cell to its right swaps to "# items selected" while rows are
        ticked — see the increment-2 reference (ERPNext item list).
      */}
      <CardHeader className="mb-0 flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-end">
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center md:max-w-xl">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-macos-text-muted dark:text-zinc-500" aria-hidden="true" />
            <Input
              type="text"
              placeholder="Filter active orders / client data..."
              className="pl-9 text-xs"
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
            />
          </div>
          {/*
            The table's only delete control. It is icon-only and gray (the same
            tone as Cancel) so it does not advertise itself as a destructive
            action at a glance — the confirmation modal does that work. The
            hover title is the only place the user sees *why* it is disabled.
          */}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            disabled={selection.count === 0}
            onClick={onDeleteSelected}
            aria-label={selection.count > 0 ? `Delete ${selection.count} selected order${selection.count === 1 ? '' : 's'}` : 'Delete selected orders'}
            title={selection.count === 0 ? 'Tick the rows you want to delete first.' : `Delete ${selection.count} order${selection.count === 1 ? '' : 's'}`}
            className="shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <TableContainer className="rounded-none border-0 bg-transparent">
          <Table>
            <colgroup>
              <col style={{ width: '44px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '220px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '260px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '100px' }} />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableSelectHead>
                  <Checkbox
                    checked={selection.allSelected}
                    indeterminate={selection.isIndeterminate}
                    disabled={orders.length === 0}
                    onChange={selection.toggleAll}
                    aria-label="Select all orders on this page"
                  />
                </TableSelectHead>
                {/*
                  When rows are ticked the whole header collapses to just the
                  "# items selected" message (ERPNext item-list behaviour) — every
                  column label disappears. The message spans all nine data columns
                  so nothing reads as a stray header.
                */}
                {selection.count === 0 ? (
                  <>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Project / Client</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="min-w-[260px]">Work Phase</TableHead>
                    <TableHead className="text-right">Due Date</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </>
                ) : (
                  <TableHead colSpan={9} className="font-semibold text-macos-text dark:text-zinc-100">
                    {formatSelectedCount(selection.count)}
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const phaseIndex = workPhases.indexOf(order.status);
                const isPending = pendingOrderIds.has(order.id);
                return (
                  <TableRow key={order.id} className="cursor-pointer" onClick={() => onSelectOrder(order)}>
                    {/*
                      The tick has to stop here. The whole row opens the order, and
                      without this a click on the box would open the detail modal
                      on top of the tick the user was aiming for.
                    */}
                    <TableSelectCell onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        checked={selection.has(order.id)}
                        onChange={() => selection.toggle(order.id)}
                        aria-label={`Select order ${order.id}`}
                      />
                    </TableSelectCell>
                    <TableCell className="font-mono font-semibold text-macos-text dark:text-zinc-100">
                      #{order.id.length > 10 ? order.id.replace('ORD-', 'PS-').slice(-8) : order.id}
                    </TableCell>
                    <TableCell>
                      <div>
                        <h3 className="font-bold text-macos-text dark:text-zinc-100 md:text-sm">{order.customer}</h3>
                        <p className="mt-0.5 max-w-xs truncate text-[10px] text-macos-text-muted dark:text-zinc-500 md:text-[11px]">{order.item} × {order.quantity} units</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={isCustomOrder(order) ? 'purple' : 'gray'}>{isCustomOrder(order) ? 'Custom' : 'Retail'}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-[300px] items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={phaseIndex === 0 || isPending}
                          onClick={(event) => {
                            event.stopPropagation();
                            onAdvancePhase(order, -1);
                          }}
                          title="Back step"
                          className="h-7 w-7 rounded-full"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <PhaseProgress status={order.status} />
                          <div className="flex items-center gap-1.5">
                            <Badge variant={getStatusBadgeVariant(order.status)}>{order.status}</Badge>
                            {/*
                              The phase on screen has already moved — this says the
                              server has not confirmed it yet. Without it, a slow
                              write looks like nothing is happening.
                            */}
                            {isPending && (
                              <span role="status" aria-label="Saving phase change" className="inline-flex">
                                <LoaderCircle className="h-3 w-3 text-macos-text-muted dark:text-zinc-500" aria-hidden="true" />
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={phaseIndex === workPhases.length - 1 || isPending}
                          onClick={(event) => {
                            event.stopPropagation();
                            onAdvancePhase(order, 1);
                          }}
                          title="Next step"
                          className="h-7 w-7 rounded-full"
                        >
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {order.dueDate ? (
                        <div className="flex items-center justify-end gap-1.5">
                          {new Date(order.dueDate) < new Date(new Date().toISOString().slice(0, 10)) && order.status !== 'Completed' && order.status !== 'Delivered' ? (
                            <>
                              <span className="h-1.5 w-1.5 rounded-full bg-macos-red" />
                              <span className="font-mono text-[10px] font-bold text-macos-red dark:text-red-300">{order.dueDate}</span>
                            </>
                          ) : (
                            <span className="font-mono text-[10px] text-macos-text-muted dark:text-zinc-500">{order.dueDate}</span>
                          )}
                        </div>
                      ) : (
                        <span className="font-mono text-[10px] text-macos-text-muted dark:text-zinc-500">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-macos-text dark:text-zinc-100">{currencySymbol}{order.amount.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono text-[10px] text-macos-text-muted dark:text-zinc-400">
                      {isCustomOrder(order) ? `${currencySymbol}${(order.totalPaid ?? 0).toFixed(2)}` : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {isCustomOrder(order) && (order.balanceDue ?? 0) > 0 ? (
                        <Badge variant="red" className="font-mono text-[10px]">{currencySymbol}{(order.balanceDue ?? 0).toFixed(2)}</Badge>
                      ) : (
                        <span className="font-mono text-[10px] text-macos-text-muted dark:text-zinc-500">{isCustomOrder(order) ? `${currencySymbol}0.00` : '—'}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={(event) => {
                            event.stopPropagation();
                            onEditOrder(order);
                          }}
                          title="Edit order in POS"
                          className="h-8 w-8"
                        >
                          <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {orders.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={10} className="py-12">
                    <div className="text-center text-sm text-macos-text-muted dark:text-zinc-500">No matching orders found.</div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}
