import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { InlineAlert } from '../../../shared/components/feedback/InlineAlert';
import { Button, DeleteConfirmModal, Input, Pagination } from '../../../shared/components/ui';
import { cn } from '../../../shared/lib/cn';
import { ApiError } from '../../../shared/api/errors';
import { useRowSelection } from '../../../shared/hooks/useRowSelection';
import { OrderDetailModal } from '../components/orders/OrderDetailModal';
import { OrderSummaryCards } from '../components/orders/OrderSummaryCards';
import { OrdersTable } from '../components/orders/OrdersTable';
import { readOrderConflict } from '../api/ordersApi';
import { useOrderFilters } from '../hooks/useOrderFilters';
import { useOrders } from '../../../app/stores/useOrderStore';
import { useUrlFilter } from '../../../shared/hooks/useUrlFilter';
import type { Order, OrderStatus } from '../types';
import { workPhases } from '../components/orders/PhaseProgress';

const STATUS_FILTERS: Array<{ label: string; value: OrderStatus | 'All' }> = [
  { label: 'All', value: 'All' },
  { label: 'Pending', value: 'Pending' },
  { label: 'Designing', value: 'Designing' },
  { label: 'In Production', value: 'In Production' },
  { label: 'Ready', value: 'Ready for Pickup' },
  { label: 'Completed', value: 'Completed' },
  { label: 'Delivered', value: 'Delivered' },
];

export default function Orders() {
  const { orders, total, page, limit, isLoading, error, refresh, goToPage, updateOrder, deleteOrder, refreshOrder, setFilters } = useOrders();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  // The URL is the one source of truth for the status filter. The param is read
  // here and written by the filter buttons; "All" deletes the param so the URL
  // stays clean (`/orders`, not `/orders?status=All`).
  const [statusParam, setStatusParam] = useUrlFilter('status', 'All');
  const statusFilter = (statusParam ?? 'All') as OrderStatus | 'All';
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [pendingOrderIds, setPendingOrderIds] = useState<ReadonlySet<string>>(() => new Set());
  const [ordersToDelete, setOrdersToDelete] = useState<Order[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  /*
   * Keep the server-side filter in step with the URL. Keyed on `statusParam`
   * (the URL value), so it fires once on arrival and once per real URL change —
   * never on every render. `setFilters` has no equality guard, so calling it from
   * a render loop would refetch the list in a storm; this does not.
   */
  useEffect(() => {
    setFilters(statusParam ? { status: statusParam as OrderStatus } : {});
  }, [statusParam, setFilters]);

  const filteredOrders = useOrderFilters(orders, {
    searchTerm,
    statusFilter,
    dateFrom,
    dateTo,
  });

  /*
   * Tick state lives on the page, not in the store: the store is a module-level
   * singleton shared with the POS screen, and a selection is a property of this
   * screen, not of the order data. The rows on offer are the filtered ones, so a
   * row hidden by the search box or the status filter cannot be deleted by
   * accident — see `useRowSelection` for why that intersection is the point.
   */
  const selection = useRowSelection(useMemo(() => filteredOrders.map((order) => order.id), [filteredOrders]));

  const markPending = (id: string, pending: boolean) =>
    setPendingOrderIds((previous) => {
      const next = new Set(previous);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });

  const updateOrderStatusByStep = async (order: Order, direction: -1 | 1) => {
    const currentIndex = workPhases.indexOf(order.status);
    if (currentIndex < 0) return;
    const nextIndex = Math.max(0, Math.min(workPhases.length - 1, currentIndex + direction));
    if (nextIndex === currentIndex) return;
    const nextStatus = workPhases[nextIndex];
    if (!nextStatus) return;

    /*
     * The board applies this move the moment it is clicked, which makes a second
     * click on the same row much more tempting than it was when the row sat
     * unchanged until the server answered. A second click would send the same
     * `updatedAt` version twice, so the server would refuse the second write and
     * the board would report a conflict against the user's own first click.
     * Dropping the repeat while one is in flight is what prevents that.
     */
    if (pendingOrderIds.has(order.id)) return;
    markPending(order.id, true);

    try {
      // `order.updatedAt` is the version this board is showing. Sending it means
      // a phase change cannot land on top of an edit someone else made while
      // this row was on screen.
      await updateOrder(order.id, { status: nextStatus }, order.updatedAt);
      setStatusError(null);
      const refreshed = await refreshOrder(order.id);
      if (selectedOrder?.id === order.id) setSelectedOrder(refreshed);
    } catch (updateError) {
      // Worth saying out loud rather than only logging: the row the user clicked
      // was out of date, so their change was not applied — and now that the board
      // moves optimistically, the card visibly springs back, which needs the
      // reason attached to it.
      setStatusError(
        readOrderConflict(updateError)
          ? `Someone else changed ${order.customer}'s order first, so this move was not applied. The board has been refreshed — check the current phase and try again.`
          : updateError instanceof ApiError
            ? updateError.message
            : 'The order status could not be updated.',
      );
      // Show the other person's version rather than leaving stale phases on screen.
      await refresh();
    } finally {
      markPending(order.id, false);
    }
  };

  /**
   * Captures the ticked orders and opens the confirmation.
   *
   * The rows are snapshotted here rather than read back off `selection` when the
   * user confirms: the list can refresh underneath an open dialog, and the dialog
   * has to name the rows that were actually ticked, not whatever happens to be
   * selected by the time Confirm gets clicked.
   */
  const openDeleteConfirm = () => {
    const ids = [...selection.selectedIds];
    if (ids.length === 0) return;
    setOrdersToDelete(filteredOrders.filter((order) => ids.includes(order.id)));
  };

  /**
   * Deletes every order named in the confirmation.
   *
   * One row at a time on purpose: `deleteOrder` is a single-row endpoint, and
   * adding a bulk route to the API would be a backend change this screen does not
   * need. The loop reports *which* rows survived rather than just how many, so a
   * partial failure leaves the user able to retry — the rows that did delete are
   * gone from the list, so their ticks go with them.
   */
  const confirmDeleteSelected = async () => {
    if (ordersToDelete.length === 0 || isDeleting) return;
    const targets = ordersToDelete;
    setStatusError(null);
    setIsDeleting(true);
    const failed: string[] = [];
    try {
      for (const order of targets) {
        try {
          await deleteOrder(order.id);
          if (selectedOrder?.id === order.id) setSelectedOrder(null);
        } catch {
          // Named by customer rather than by id: the id means nothing to the
          // person reading this, and they need to know which job to retry.
          failed.push(order.customer);
        }
      }
    } finally {
      // A throw before the close below would otherwise leave Confirm spinning
      // on a dialog that never goes away.
      setIsDeleting(false);
    }
    setOrdersToDelete([]);
    selection.clear();

    if (failed.length > 0) {
      setStatusError(
        `${failed.length} of ${targets.length} orders could not be deleted: ${failed.join(', ')}. The rest were removed.`,
      );
    }
  };

  const handleEditOrder = (order: Order) => {
    navigate('/pos', { state: { editOrderId: order.id } });
  };

  if (isLoading) return <LoadingState label="Loading orders" className="min-h-64" />;
  if (error) return <ErrorState message={error} onRetry={refresh} className="min-h-64" />;

  return (
    <div className="space-y-5">
      {statusError && <InlineAlert message={statusError} onDismiss={() => setStatusError(null)} />}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-macos-text dark:text-zinc-100 lg:text-title">Orders</h1>
          <p className="mt-1 text-sm text-macos-text-muted dark:text-zinc-400">
            Track active jobs, phase movement, customer artwork, and production-ready details.
          </p>
        </div>
        <Button onClick={() => navigate('/pos')} leftIcon={<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}>
          New POS Order
        </Button>
      </div>

      <OrderSummaryCards orders={orders} />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((filter) => {
            const isActive = statusFilter === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusParam(filter.value)}
                className={cn(
                  'cursor-pointer rounded-full px-3 py-1.5 text-2xs font-bold',
                  isActive
                    ? 'bg-macos-blue text-[var(--app-accent-ink)]'
                    : 'border text-macos-text-muted hover:bg-[var(--app-state-hover)] hover:text-macos-text dark:text-zinc-400 dark:hover:bg-[#414143] dark:hover:text-zinc-200',
                )}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-macos-text-muted dark:text-zinc-500" aria-hidden="true" />
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 w-auto text-2xs"
            placeholder="From"
          />
          <span className="text-2xs text-macos-text-muted dark:text-zinc-500">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 w-auto text-2xs"
            placeholder="To"
          />
          {(dateFrom || dateTo) && (
            <Button type="button" variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>
              Clear dates
            </Button>
          )}
        </div>
      </div>

      <OrdersTable
        orders={filteredOrders}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onSelectOrder={setSelectedOrder}
        onDeleteSelected={openDeleteConfirm}
        selection={selection}
        pendingOrderIds={pendingOrderIds}
        footer={<Pagination page={page} limit={limit} total={total} onPageChange={goToPage} />}
      />

      <OrderDetailModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onEditOrder={handleEditOrder}
        onAdvancePhase={updateOrderStatusByStep}
        onRefreshOrder={refreshOrder}
      />

      <DeleteConfirmModal
        isOpen={ordersToDelete.length > 0}
        itemLabels={ordersToDelete.map((order) => order.customer)}
        isBusy={isDeleting}
        onClose={() => setOrdersToDelete([])}
        onConfirm={confirmDeleteSelected}
      />
    </div>
  );
}
