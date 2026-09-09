import React, { createContext, useContext, useState, type ReactNode } from 'react';
import { MOCK_ORDERS } from '../data/mockOrders';
import type { CreateOrder, Order, UpdateOrder } from '../types';

interface OrderContextValue {
  orders: Order[];
  addOrder: (order: CreateOrder) => string;
  updateOrder: (id: string, order: UpdateOrder) => void;
  deleteOrder: (id: string) => void;
}

const OrderContext = createContext<OrderContextValue | undefined>(undefined);

export function OrderProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>(MOCK_ORDERS);

  const addOrder = (newOrder: CreateOrder) => {
    const id = `ORD-${Date.now()}`;
    const order: Order = {
      ...newOrder,
      id,
      date: new Date().toISOString().split('T')[0],
      status: newOrder.status || 'Pending',
    };
    setOrders((previousOrders) => [order, ...previousOrders]);
    return id;
  };

  const updateOrder = (id: string, updatedOrder: UpdateOrder) => {
    setOrders((previousOrders) => previousOrders.map((order) => (
      order.id === id ? { ...order, ...updatedOrder } : order
    )));
  };

  const deleteOrder = (id: string) => {
    setOrders((previousOrders) => previousOrders.filter((order) => order.id !== id));
  };

  return (
    <OrderContext.Provider value={{ orders, addOrder, updateOrder, deleteOrder }}>
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
