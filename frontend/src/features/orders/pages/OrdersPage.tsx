import { useState } from 'react';
import { ArrowRight, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { Button, Input } from '../../../shared/components/ui';
import { cn } from '../../../shared/lib/cn';
import { OrderDetailModal } from '../components/orders/OrderDetailModal';
import { OrderSummaryCards } from '../components/orders/OrderSummaryCards';
import { OrdersTable } from '../components/orders/OrdersTable';
import { useOrderFilters } from '../hooks/useOrderFilters';
import { useOrders } from '../state/OrderContext';
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
  const { orders, isLoading, error, refresh, updateOrder, deleteOrder, refreshOrder } = useOrders();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'All'>('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const filteredOrders = useOrderFilters(orders, {
    searchTerm,
    statusFilter,
    dateFrom,
    dateTo,
  });

  const updateOrderStatusByStep = async (order: Order, direction: -1 | 1) => {
    const currentIndex = workPhases.indexOf(order.status);
    if (currentIndex < 0) return;
    const nextIndex = Math.max(0, Math.min(workPhases.length - 1, currentIndex + direction));
    if (nextIndex === currentIndex) return;
    const nextStatus = workPhases[nextIndex];
    if (!nextStatus) return;
    try {
      await updateOrder(order.id, { status: nextStatus });
      const refreshed = await refreshOrder(order.id);
      if (selectedOrder?.id === order.id) setSelectedOrder(refreshed);
    } catch (updateError) {
      console.error('Unable to update order status:', updateError);
    }
  };

  const handleDeleteOrder = async (order: Order) => {
    if (!window.confirm(`Delete order ${order.id} for ${order.customer}?`)) return;
    try {
      await deleteOrder(order.id);
      if (selectedOrder?.id === order.id) setSelectedOrder(null);
    } catch (deleteError) {
      console.error('Unable to delete order:', deleteError);
    }
  };

  const handleEditOrder = (order: Order) => {
    navigate('/pos', { state: { editOrderId: order.id } });
  };

  if (isLoading) return <LoadingState label="Loading orders" className="min-h-64" />;
  if (error) return <ErrorState message={error} onRetry={refresh} className="min-h-64" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-macos-text dark:text-zinc-100 lg:text-[28px]">Orders</h1>
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
                onClick={() => setStatusFilter(filter.value)}
                className={cn(
                  'cursor-pointer rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] transition-all',
                  isActive
                    ? 'bg-macos-blue text-white shadow-[0_8px_18px_rgb(0_122_255/0.22)]'
                    : 'border border-white/45 bg-white/52 text-macos-text-muted hover:bg-white/72 hover:text-macos-text dark:border-white/10 dark:bg-white/6 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-200',
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
            className="h-8 w-auto text-[10px]"
            placeholder="From"
          />
          <span className="text-[10px] text-macos-text-muted dark:text-zinc-500">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 w-auto text-[10px]"
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
        onEditOrder={handleEditOrder}
        onDeleteOrder={handleDeleteOrder}
        onAdvancePhase={updateOrderStatusByStep}
      />

      <OrderDetailModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onAdvancePhase={updateOrderStatusByStep}
        onRefreshOrder={refreshOrder}
      />
    </div>
  );
}
