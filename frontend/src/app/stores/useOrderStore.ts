import { useShallow } from 'zustand/react/shallow';
import { orderPaymentsApi } from '../../features/orders/api/orderPaymentsApi';
import type { CreateOrderPayment, OrderPayment } from '../../features/orders/api/orderPaymentsApi';
import { ordersApi, type OrderListFilters } from '../../features/orders/api/ordersApi';
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

/**
 * `OrderListFilters` is the third type argument because this store does carry a
 * filter: `setFilters({ status })` narrows the list server-side, and the filter
 * is re-sent on every refetch — including the silent background ones — so a
 * revalidation cannot quietly widen the board back to every order.
 */
export const useOrderStore = createListStore<Order, OrderActions, OrderListFilters>({
  list: (query) => ordersApi.list(query),
  fallbackErrorMessage: 'Orders could not be loaded.',

  actions: ({
    snapshot,
    mutateItems,
    setError,
    optimisticUpdate,
    commitOptimistic,
    rollbackOptimistic,
  }) => ({
    addOrder: async (order) => {
      // `item` and `quantity` are not sent: the contract omits them because the
      // API derives both from `lineItems` (orders.service.ts), and a client-side
      // copy could only ever disagree with that derivation.
      const created = await ordersApi.create(order);
      mutateItems((items) => [created, ...items]);
      setError(null);
      // Order creation can move inventory server-side, so both domains are
      // announced: the dashboard pipeline and the stock ledger must agree.
      emitDataChange('orders', 'inventory');
      return created;
    },

    /**
     * Applied to the board immediately, then confirmed or taken back.
     *
     * This is the only optimistic write in the app, and it is deliberately the
     * one that is safe: a production phase is a label on a job, so showing the
     * new one a moment early costs nothing if the server refuses. Everything that
     * moves money — POS checkout, `voidTransaction`, `recordPayment` — and
     * everything that changes stock still waits for the server, because a wrong
     * balance or a phantom stock movement is worse than a slow screen.
     *
     * `updatedAt` is never part of the optimistic patch. It is the
     * compare-and-swap version token, and a guessed value would corrupt the very
     * check it exists to serve — the row has to keep carrying the version the
     * server gave it. `UpdateOrder` omits the field, so the types enforce this as
     * well as the comment does.
     */
    updateOrder: async (id, order, expectedUpdatedAt) => {
      optimisticUpdate(id, order);
      try {
        const updated = await ordersApi.update(id, order, expectedUpdatedAt);
        commitOptimistic(id, updated);
        setError(null);
        emitDataChange('orders');
        return updated;
      } catch (error) {
        rollbackOptimistic(id);
        /*
         * Rethrown rather than swallowed. The caller keeps its own failure
         * handling — the orders board turns a stale version into a sentence naming
         * the other person's change — and swallowing here would leave the board
         * showing a phase the server had just refused.
         */
        throw error;
      }
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
      /*
       * The writer, not the filter itself. The page owns what is selected (it has
       * to, to render the control), so exposing `state.filters` here as well would
       * invite a second source of truth for the same decision. The store's copy
       * exists only so a background refetch cannot drop the filter.
       */
      setFilters: state.setFilters,
      addOrder: state.addOrder,
      updateOrder: state.updateOrder,
      deleteOrder: state.deleteOrder,
      recordPayment: state.recordPayment,
      refreshOrder: state.refreshOrder,
    })),
  );
}
