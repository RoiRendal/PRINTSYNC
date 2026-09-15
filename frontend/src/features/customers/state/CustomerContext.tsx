import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { customersApi } from '../api/customersApi';
import { ApiError } from '../../../shared/api/errors';
import type { CreateCustomer, Customer, UpdateCustomer } from '../types';

interface CustomerContextValue {
  customers: Customer[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  goToPage: (page: number) => void;
  addCustomer: (customer: CreateCustomer) => Promise<Customer>;
  updateCustomer: (id: string, customer: UpdateCustomer) => Promise<Customer>;
  deleteCustomer: (id: string) => Promise<void>;
}

const CustomerContext = createContext<CustomerContextValue | undefined>(undefined);

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    void customersApi.list({ page, limit })
      .then((response) => {
        if (mounted) {
          setCustomers(response.data);
          setTotal(response.total);
          setError(null);
        }
      })
      .catch((requestError: unknown) => {
        if (mounted) setError(requestError instanceof ApiError ? requestError.message : 'Customers could not be loaded.');
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => { mounted = false; };
  }, [refreshKey, page, limit]);

  const addCustomer = async (newCustomer: CreateCustomer) => {
    const customer = await customersApi.create(newCustomer);
    setCustomers((previous) => [customer, ...previous]);
    setError(null);
    return customer;
  };

  const updateCustomer = async (id: string, updatedCustomer: UpdateCustomer) => {
    const customer = await customersApi.update(id, updatedCustomer);
    setCustomers((previous) => previous.map((current) => current.id === id ? customer : current));
    setError(null);
    return customer;
  };

  const deleteCustomer = async (id: string) => {
    await customersApi.remove(id);
    setCustomers((previous) => previous.filter((current) => current.id !== id));
    setError(null);
  };

  const goToPage = (nextPage: number) => setPage(Math.max(1, nextPage));
  const refresh = () => setRefreshKey((value) => value + 1);

  return (
    <CustomerContext.Provider
      value={{
        customers,
        total,
        page,
        limit,
        isLoading,
        error,
        refresh,
        goToPage,
        addCustomer,
        updateCustomer,
        deleteCustomer,
      }}
    >
      {children}
    </CustomerContext.Provider>
  );
}

export function useCustomers() {
  const context = useContext(CustomerContext);
  if (context === undefined) {
    throw new Error('useCustomers must be used within a CustomerProvider');
  }
  return context;
}
