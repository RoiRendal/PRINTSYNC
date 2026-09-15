import { useShallow } from 'zustand/react/shallow';
import { customersApi } from '../../features/customers/api/customersApi';
import type { CreateCustomer, Customer, UpdateCustomer } from '../../features/customers/types';
import { createListStore } from '../../shared/store/createListStore';

interface CustomerActions {
  addCustomer: (customer: CreateCustomer) => Promise<Customer>;
  updateCustomer: (id: string, customer: UpdateCustomer) => Promise<Customer>;
  deleteCustomer: (id: string) => Promise<void>;
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
      return created;
    },

    updateCustomer: async (id, customer) => {
      const updated = await customersApi.update(id, customer);
      mutateItems((items) => items.map((current) => (current.id === id ? updated : current)));
      setError(null);
      return updated;
    },

    deleteCustomer: async (id) => {
      await customersApi.remove(id);
      mutateItems((items) => items.filter((current) => current.id !== id));
      setError(null);
    },

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
    })),
  );
}
