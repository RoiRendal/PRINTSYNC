import { createContext, useContext, useState, type ReactNode } from 'react';
import { MOCK_INVENTORY } from '../data/mockInventory';
import type { CreateInventoryItem, InventoryItem, UpdateInventoryItem } from '../types';

interface InventoryContextValue {
  items: InventoryItem[];
  addItem: (item: CreateInventoryItem) => void;
  updateItem: (id: string, item: UpdateInventoryItem) => void;
  deleteItem: (id: string) => void;
}

const InventoryContext = createContext<InventoryContextValue | undefined>(undefined);

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<InventoryItem[]>(MOCK_INVENTORY);

  const addItem = (newItem: CreateInventoryItem) => {
    const item: InventoryItem = {
      ...newItem,
      id: `INV-${String(items.length + 1).padStart(3, '0')}`,
    };
    setItems((previousItems) => [...previousItems, item]);
  };

  const updateItem = (id: string, updatedItem: UpdateInventoryItem) => {
    setItems((previousItems) => previousItems.map((item) => (
      item.id === id ? { ...item, ...updatedItem } : item
    )));
  };

  const deleteItem = (id: string) => {
    setItems((previousItems) => previousItems.filter((item) => item.id !== id));
  };

  return (
    <InventoryContext.Provider value={{ items, addItem, updateItem, deleteItem }}>
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
}
