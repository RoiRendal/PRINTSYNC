import { useShallow } from 'zustand/react/shallow';
import { orderPaymentsApi } from '../../features/orders/api/orderPaymentsApi';
import type { CreateOrderPayment, OrderPayment } from '../../features/orders/api/orderPaymentsApi';
import { ordersApi } from '../../features/orders/api/ordersApi';
import type { CreateOrder, Order, UpdateOrder } from '../../features/orders/types';
import { createListStore } from '../../shared/store/createListStore';
import { emitDataChange } from '../../shared/store/dataEvents';

interface OrderActions {
  addOrder: (order: CreateOrder) => Promise<Order>;
  /**
   * @param expectedUpdatedAt the order's `updatedAt` as the editor loaded it. The
   *   save is refused if the order has moved on since, so two staff editing the
   *   same order cannot silently overwrite each other.
   */
  updateOrder: (id: string, order: UpdateOrder, expectedUpdatedAt: string) => Promise<Order>;
  deleteOrder: (id: string) => Promise<void>;
  recordPayment: (payment: CreateOrderPayment) => Promise<OrderPayment>;
  refreshOrder: (id: string) => Promise<Order>;
  reset: () => void;
}

export const useOrderStore = createListStore<Order, OrderActions>({
  list: (query) => ordersApi.list(query),
  fallbackErrorMessage: 'Orders could not be loaded.',

  actions: ({ snapshot, mutateItems, setError }) => ({
    addOrder: async (order) => {
      const lineItems = order.lineItems?.length
        ? order.lineItems.map((item) => ({ ...item, unitPrice: item.unitPrice ?? 0 }))
        : [{ name: order.item, quantity: order.quantity, designId: order.designId, unitPrice: 0 }];
      const created = await ordersApi.create({ ...order, lineItems });
      mutateItems((items) => [created, ...items]);
      setError(null);
      // Order creation can move inventory server-side, so both domains are
      // announced: the dashboard pipeline and the stock ledger must agree.
      emitDataChange('orders', 'inventory');
      return created;
    },

    updateOrder: async (id, order, expectedUpdatedAt) => {
      const updated = await ordersApi.update(id, order, expectedUpdatedAt);
      mutateItems((items) => items.map((current) => (current.id === id ? updated : current)));
      setError(null);
      emitDataChange('orders');
      return updated;
    },

    deleteOrder: async (id) => {
      await ordersApi.remove(id);
      mutateItems((items) => items.filter((current) => current.id !== id));
      setError(null);
      emitDataChange('orders');
    },

    recordPayment: async (payment) => {
      const created = await orderPaymentsApi.create(payment);
      setError(null);
      // A partial payment changes the order's balance, the dashboard revenue
      // figure, and the transaction history at the same time.
      emitDataChange('orders', 'payments');
      return created;
    },

    /** Re-reads a single order (used after payment/status side effects). */
    refreshOrder: async (id) => {
      const order = await ordersApi.get(id);
      mutateItems((items) => items.map((current) => (current.id === id ? order : current)));
      setError(null);
      return order;
    },

    reset: () => {
      snapshot().resetList();
    },
  }),
});

/** Drop-in replacement for the removed `OrderContext`. */
export function useOrders() {
  return useOrderStore(
    useShallow((state) => ({
      orders: state.items,
      total: state.total,
      page: state.page,
      limit: state.limit,
      isLoading: state.isLoading,
      error: state.error,
      refresh: state.refresh,
      goToPage: state.goToPage,
      addOrder: state.addOrder,
      updateOrder: state.updateOrder,
      deleteOrder: state.deleteOrder,
      recordPayment: state.recordPayment,
      refreshOrder: state.refreshOrder,
    })),
  );
}
