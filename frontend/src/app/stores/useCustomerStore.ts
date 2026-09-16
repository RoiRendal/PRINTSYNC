import { useShallow } from 'zustand/react/shallow';
import { customersApi } from '../../features/customers/api/customersApi';
import type { CreateCustomer, Customer, UpdateCustomer } from '../../features/customers/types';
import { createListStore } from '../../shared/store/createListStore';
import { emitDataChange } from '../../shared/store/dataEvents';

interface CustomerActions {
  addCustomer: (customer: CreateCustomer) => Promise<Customer>;
  updateCustomer: (id: string, customer: UpdateCustomer) => Promise<Customer>;
  deleteCustomer: (id: string) => Promise<void>;
  /** How many orders point at a customer. Used by the delete confirmation. */
  countOrders: (id: string) => Promise<number>;
  reset: () => void;
}

export const useCustomerStore = createListStore<Customer, CustomerActions>({
  list: (query) => customersApi.list(query),
  fallbackErrorMessage: 'Customers could not be loaded.',

  actions: ({ snapshot, mutateItems, setError }) => ({
    addCustomer: async (customer) => {
      const created = await customersApi.create(customer);
      mutateItems((items) => [created, ...items]);
      setError(null);
      emitDataChange('customers');
      return created;
    },

    updateCustomer: async (id, customer) => {
      const updated = await customersApi.update(id, customer);
      mutateItems((items) => items.map((current) => (current.id === id ? updated : current)));
      setError(null);
      emitDataChange('customers');
      return updated;
    },

    deleteCustomer: async (id) => {
      await customersApi.remove(id);
      mutateItems((items) => items.filter((current) => current.id !== id));
      setError(null);
      emitDataChange('customers');
    },

    /*
     * Deliberately not routed through `setError`. A count that could not be
     * fetched is not a page-level failure, and putting it there would replace the
     * whole directory with an error view over a warning that is merely optional.
     * The rejection is left to the caller, which treats it as "no warning".
     */
    countOrders: (id) => customersApi.orderCount(id).then((result) => result.orderCount),

    reset: () => {
      snapshot().resetList();
    },
  }),
});

/** Drop-in replacement for the removed `CustomerContext`. */
export function useCustomers() {
  return useCustomerStore(
    useShallow((state) => ({
      customers: state.items,
      total: state.total,
      page: state.page,
      limit: state.limit,
      isLoading: state.isLoading,
      error: state.error,
      refresh: state.refresh,
      goToPage: state.goToPage,
      addCustomer: state.addCustomer,
      updateCustomer: state.updateCustomer,
      deleteCustomer: state.deleteCustomer,
      countOrders: state.countOrders,
    })),
  );
}
