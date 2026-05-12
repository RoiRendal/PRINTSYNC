import React, { createContext, useContext, useState, ReactNode } from 'react';
import { InventoryItem, Design, Order } from '../../../shared/types/domain';
import { MOCK_INVENTORY, MOCK_DESIGNS, MOCK_ORDERS } from '../../../shared/constants/mocks';

interface InventoryContextType {
  items: InventoryItem[];
  designs: Design[];
  orders: Order[];
  addItem: (item: Omit<InventoryItem, 'id'>) => void;
  updateItem: (id: string, item: Partial<InventoryItem>) => void;
  deleteItem: (id: string) => void;
  addDesign: (design: Omit<Design, 'id' | 'createdAt'>) => void;
  updateDesign: (id: string, design: Partial<Design>) => void;
  deleteDesign: (id: string) => void;
  addOrder: (order: Omit<Order, 'id' | 'date'>) => string;
  updateOrder: (id: string, order: Partial<Order>) => void;
  deleteOrder: (id: string) => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<InventoryItem[]>(MOCK_INVENTORY);
  const [designs, setDesigns] = useState<Design[]>(MOCK_DESIGNS);
  const [orders, setOrders] = useState<Order[]>(MOCK_ORDERS as Order[]);

  const addItem = (newItem: Omit<InventoryItem, 'id'>) => {
    const item: InventoryItem = {
      ...newItem,
      id: `INV-${String(items.length + 1).padStart(3, '0')}`,
    };
    setItems(prev => [...prev, item]);
  };

  const updateItem = (id: string, updatedItem: Partial<InventoryItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updatedItem } : item));
  };

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const addDesign = (newDesign: Omit<Design, 'id' | 'createdAt'>) => {
    const design: Design = {
      ...newDesign,
      id: `DSG-${String(designs.length + 1).padStart(3, '0')}`,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setDesigns(prev => [...prev, design]);
  };

  const deleteDesign = (id: string) => {
    setDesigns(prev => prev.filter(d => d.id !== id));
  };

  const updateDesign = (id: string, updatedDesign: Partial<Design>) => {
    setDesigns(prev => prev.map(d => d.id === id ? { ...d, ...updatedDesign } : d));
  };

  const addOrder = (newOrder: Omit<Order, 'id' | 'date'>) => {
    const id = `ORD-${Date.now()}`;
    const order: Order = {
      ...newOrder,
      id,
      date: new Date().toISOString().split('T')[0],
      status: newOrder.status || 'Pending'
    };
    setOrders(prev => [order, ...prev]);
    return id;
  };

  const updateOrder = (id: string, updatedOrder: Partial<Order>) => {
    setOrders(prev => prev.map(order => order.id === id ? { ...order, ...updatedOrder } : order));
  };

  const deleteOrder = (id: string) => {
    setOrders(prev => prev.filter(order => order.id !== id));
  };

  return (
    <InventoryContext.Provider value={{ 
      items, 
      designs, 
      orders,
      addItem, 
      updateItem, 
      deleteItem, 
      addDesign, 
      updateDesign, 
      deleteDesign,
      addOrder,
      updateOrder,
      deleteOrder
    }}>
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};

