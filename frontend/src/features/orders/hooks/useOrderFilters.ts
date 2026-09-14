import { useMemo } from 'react';
import type { Order } from '../types';

export function useOrderFilters(orders: Order[], searchTerm: string) {
  const filteredOrders = useMemo(() => {
    const query = searchTerm.toLowerCase();
    return orders.filter(
      (order) =>
        order.customer.toLowerCase().includes(query) ||
        order.id.toLowerCase().includes(query) ||
        order.item.toLowerCase().includes(query),
    );
  }, [orders, searchTerm]);

  return filteredOrders;
}
