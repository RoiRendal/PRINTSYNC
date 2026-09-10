import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { inventoryApi } from '../api/inventoryApi';
import type { CreateInventoryItem, InventoryItem, UpdateInventoryItem } from '../types';

interface InventoryContextValue {
  items: InventoryItem[];
  addItem: (item: CreateInventoryItem) => void;
  updateItem: (id: string, item: UpdateInventoryItem) => void;
  deleteItem: (id: string) => void;
}

const InventoryContext = createContext<InventoryContextValue | undefined>(undefined);

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<InventoryItem[]>([]);

  useEffect(() => {
    let mounted = true;
    void inventoryApi.list().then((inventory) => {
      if (mounted) setItems(inventory);
    });
    return () => { mounted = false; };
  }, []);

  const addItem = (newItem: CreateInventoryItem) => {
    void inventoryApi.create(newItem).then((item) => {
      setItems((previousItems) => [...previousItems, item]);
    });
  };

  const updateItem = (id: string, updatedItem: UpdateInventoryItem) => {
    const existingItem = items.find((item) => item.id === id);
    const nextStock = updatedItem.stock ?? existingItem?.stock;
    const { stock: _stock, ...details } = updatedItem;
    void inventoryApi.update(id, details).then((item) => {
      if (nextStock === undefined || nextStock === item.stock) {
        setItems((previousItems) => previousItems.map((current) => current.id === id ? item : current));
        return;
      }
      void inventoryApi.adjust(id, { quantity: nextStock - item.stock, reason: 'Inventory count correction' }).then((adjustedItem) => {
        setItems((previousItems) => previousItems.map((current) => current.id === id ? adjustedItem : current));
      });
    });
  };

  const deleteItem = (id: string) => {
    void inventoryApi.remove(id).then(() => {
      setItems((previousItems) => previousItems.filter((item) => item.id !== id));
    });
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
