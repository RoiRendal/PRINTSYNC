import { useMemo } from 'react';
import type { Order, OrderStatus } from '../types';

export interface OrderFilterState {
  searchTerm: string;
  statusFilter: OrderStatus | 'All';
  dateFrom: string;
  dateTo: string;
}

export function useOrderFilters(
  orders: Order[],
  filters: OrderFilterState,
) {
  const filteredOrders = useMemo(() => {
    const query = filters.searchTerm.toLowerCase();
    return orders.filter((order) => {
      const matchesSearch =
        !query ||
        order.customer.toLowerCase().includes(query) ||
        order.id.toLowerCase().includes(query) ||
        order.item.toLowerCase().includes(query);

      const matchesStatus =
        filters.statusFilter === 'All' || order.status === filters.statusFilter;

      const orderDate = order.date.slice(0, 10);
      const matchesDateFrom =
        !filters.dateFrom || orderDate >= filters.dateFrom;
      const matchesDateTo =
        !filters.dateTo || orderDate <= filters.dateTo;

      return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo;
    });
  }, [orders, filters]);

  return filteredOrders;
}
