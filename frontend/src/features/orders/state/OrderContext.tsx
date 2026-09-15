import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ordersApi } from '../api/ordersApi';
import { orderPaymentsApi } from '../api/orderPaymentsApi';
import { ApiError } from '../../../shared/api/errors';
import type { CreateOrder, Order, UpdateOrder } from '../types';
import type { CreateOrderPayment, OrderPayment } from '../api/orderPaymentsApi';

interface OrderContextValue {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  goToPage: (page: number) => void;
  addOrder: (order: CreateOrder) => Promise<Order>;
  updateOrder: (id: string, order: UpdateOrder) => Promise<Order>;
  deleteOrder: (id: string) => Promise<void>;
  recordPayment: (payment: CreateOrderPayment) => Promise<OrderPayment>;
  refreshOrder: (id: string) => Promise<Order>;
}

const OrderContext = createContext<OrderContextValue | undefined>(undefined);

export function OrderProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    void ordersApi.list({ page, limit })
      .then((response) => {
        if (mounted) {
          setOrders(response.data);
          setTotal(response.total);
          setError(null);
        }
      })
      .catch((requestError: unknown) => {
        if (!mounted) return;
        setError(requestError instanceof ApiError ? requestError.message : 'Orders could not be loaded.');
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => { mounted = false; };
  }, [refreshKey, page, limit]);

  const addOrder = async (newOrder: CreateOrder) => {
    const lineItems = newOrder.lineItems?.length
      ? newOrder.lineItems.map((item) => ({ ...item, unitPrice: item.unitPrice ?? 0 }))
      : [{ name: newOrder.item, quantity: newOrder.quantity, designId: newOrder.designId, unitPrice: 0 }];
    const createdOrder = await ordersApi.create({ ...newOrder, lineItems });
    setOrders((previousOrders) => [createdOrder, ...previousOrders]);
    setError(null);
    return createdOrder;
  };

  const updateOrder = async (id: string, updatedOrder: UpdateOrder) => {
    const updated = await ordersApi.update(id, updatedOrder);
    setOrders((previousOrders) => previousOrders.map((order) => (
      order.id === id ? updated : order
    )));
    setError(null);
    return updated;
  };

  const deleteOrder = async (id: string) => {
    await ordersApi.remove(id);
    setOrders((previousOrders) => previousOrders.filter((order) => order.id !== id));
    setError(null);
  };

  const recordPayment = async (payment: CreateOrderPayment) => {
    const created = await orderPaymentsApi.create(payment);
    setError(null);
    return created;
  };

  const refreshOrder = async (id: string) => {
    const order = await ordersApi.get(id);
    setOrders((previousOrders) => previousOrders.map((o) => o.id === id ? order : o));
    setError(null);
    return order;
  };

  const goToPage = (nextPage: number) => {
    setPage(Math.max(1, nextPage));
  };

  const refresh = () => setRefreshKey((value) => value + 1);

  return (
    <OrderContext.Provider value={{ orders, total, page, limit, isLoading, error, refresh, goToPage, addOrder, updateOrder, deleteOrder, recordPayment, refreshOrder }}>
      {children}
    </OrderContext.Provider>
  );
}

export function useOrders() {
  const context = useContext(OrderContext);
  if (context === undefined) {
    throw new Error('useOrders must be used within an OrderProvider');
  }
  return context;
}
