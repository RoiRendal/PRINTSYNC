import { useShallow } from 'zustand/react/shallow';
import { orderPaymentsApi } from '../../features/orders/api/orderPaymentsApi';
import type { CreateOrderPayment, OrderPayment } from '../../features/orders/api/orderPaymentsApi';
import { ordersApi } from '../../features/orders/api/ordersApi';
import type { CreateOrder, Order, UpdateOrder } from '../../features/orders/types';
import { createListStore } from '../../shared/store/createListStore';

interface OrderActions {
  addOrder: (order: CreateOrder) => Promise<Order>;
  updateOrder: (id: string, order: UpdateOrder) => Promise<Order>;
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
      return created;
    },

    updateOrder: async (id, order) => {
      const updated = await ordersApi.update(id, order);
      mutateItems((items) => items.map((current) => (current.id === id ? updated : current)));
      setError(null);
      return updated;
    },

    deleteOrder: async (id) => {
      await ordersApi.remove(id);
      mutateItems((items) => items.filter((current) => current.id !== id));
      setError(null);
    },

    recordPayment: async (payment) => {
      const created = await orderPaymentsApi.create(payment);
      setError(null);
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
