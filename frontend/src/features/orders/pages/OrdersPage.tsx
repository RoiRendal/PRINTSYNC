import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { Button } from '../../../shared/components/ui';
import { OrderDetailModal } from '../components/orders/OrderDetailModal';
import { OrderSummaryCards } from '../components/orders/OrderSummaryCards';
import { OrdersTable } from '../components/orders/OrdersTable';
import { useOrderFilters } from '../hooks/useOrderFilters';
import { useOrders } from '../state/OrderContext';
import type { Order } from '../types';
import { workPhases } from '../components/orders/PhaseProgress';

export default function Orders() {
  const { orders, isLoading, error, refresh, updateOrder, deleteOrder } = useOrders();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const filteredOrders = useOrderFilters(orders, searchTerm);

  const updateOrderStatusByStep = async (order: Order, direction: -1 | 1) => {
    const currentIndex = workPhases.indexOf(order.status);
    if (currentIndex < 0) return;
    const nextIndex = Math.max(0, Math.min(workPhases.length - 1, currentIndex + direction));
    if (nextIndex === currentIndex) return;
    const nextStatus = workPhases[nextIndex];
    if (!nextStatus) return;
    try {
      const updated = await updateOrder(order.id, { status: nextStatus });
      if (selectedOrder?.id === order.id) setSelectedOrder(updated);
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
      />
    </div>
  );
}
