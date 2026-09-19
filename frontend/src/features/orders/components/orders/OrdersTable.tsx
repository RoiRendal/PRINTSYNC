import { ArrowRight, ChevronLeft, ChevronRight, Edit3, LoaderCircle, Search, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  getStatusBadgeVariant,
} from '../../../../shared/components/ui';
import { useBusinessBranding } from '../../../../app/providers/BusinessBrandingProvider';
import type { Order } from '../../types';
import { isCustomOrder } from '../../utils/orderType';
import { PhaseProgress, workPhases } from './PhaseProgress';

interface OrdersTableProps {
  orders: Order[];
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSelectOrder: (order: Order) => void;
  onEditOrder: (order: Order) => void;
  onDeleteOrder: (order: Order) => void;
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
  onDeleteOrder,
  onAdvancePhase,
  pendingOrderIds,
}: OrdersTableProps) {
  const { currencySymbol } = useBusinessBranding();
  return (
    <Card variant="elevated" padding="none" className="overflow-hidden">
      <CardHeader className="mb-0 flex-col gap-3 border-b border-black/5 p-4 dark:border-white/10 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Active Dispatch Queue</CardTitle>
          <CardDescription>Click any row to inspect assets, notes, and phase controls.</CardDescription>
        </div>
        <div className="relative w-full md:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-macos-text-muted" aria-hidden="true" />
          <Input
            type="text"
            placeholder="Filter active orders / client data..."
            className="pl-9 text-xs"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
          />
        </div>
      </CardHeader>

      <CardContent>
        <TableContainer className="rounded-none border-0 bg-transparent shadow-none">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Order ID</TableHead>
                <TableHead>Project / Client</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="min-w-[260px]">Work Phase</TableHead>
                <TableHead className="text-right">Due Date</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const phaseIndex = workPhases.indexOf(order.status);
                const isPending = pendingOrderIds.has(order.id);
                return (
                  <TableRow key={order.id} className="cursor-pointer" onClick={() => onSelectOrder(order)}>
                    <TableCell className="font-mono font-semibold text-macos-text dark:text-zinc-100">
                      #{order.id.length > 10 ? order.id.replace('ORD-', 'PS-').slice(-8) : order.id}
                    </TableCell>
                    <TableCell>
                      <div>
                        <h3 className="font-bold text-macos-text dark:text-zinc-100 md:text-sm">{order.customer}</h3>
                        <p className="mt-0.5 max-w-xs truncate text-[10px] text-macos-text-muted md:text-[11px]">{order.item} × {order.quantity} units</p>
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
                              <span role="status" className="inline-flex">
                                <LoaderCircle className="h-3 w-3 animate-spin text-macos-text-muted" aria-hidden="true" />
                                {/*
                                  A live region announces its *text*; an `aria-label`
                                  alone is not dependable across screen readers. The
                                  spinner is also stopped outright under
                                  `prefers-reduced-motion`, so this text is the only
                                  signal that survives for those users.
                                */}
                                <span className="sr-only">Saving…</span>
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
                              <span className="h-1.5 w-1.5 rounded-full bg-macos-red shadow-[0_0_6px_rgb(255_59_48/0.6)]" />
                              <span className="font-mono text-[10px] font-bold text-macos-red dark:text-red-300">{order.dueDate}</span>
                            </>
                          ) : (
                            <span className="font-mono text-[10px] text-macos-text-muted">{order.dueDate}</span>
                          )}
                        </div>
                      ) : (
                        <span className="font-mono text-[10px] text-macos-text-muted">—</span>
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
                        <span className="font-mono text-[10px] text-macos-text-muted">{isCustomOrder(order) ? `${currencySymbol}0.00` : '—'}</span>
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
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteOrder(order);
                          }}
                          title="Delete order"
                          className="h-8 w-8 text-macos-red hover:text-macos-red"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="View details">
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {orders.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={9} className="py-12">
                    <div className="text-center text-sm text-macos-text-muted">No matching orders found.</div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>

      <div className="surface-toolbar flex justify-center px-3 py-3 text-[9px] font-bold uppercase tracking-[0.24em] text-macos-text-muted">
        End of Active Dispatch Queue
      </div>
    </Card>
  );
}
