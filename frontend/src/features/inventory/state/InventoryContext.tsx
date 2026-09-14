import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { inventoryApi } from '../api/inventoryApi';
import { ApiError } from '../../../shared/api/errors';
import type { CreateInventoryItem, InventoryItem, UpdateInventoryItem } from '../types';

interface InventoryContextValue {
  items: InventoryItem[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  addItem: (item: CreateInventoryItem) => Promise<InventoryItem>;
  updateItem: (id: string, item: UpdateInventoryItem) => Promise<InventoryItem>;
  deleteItem: (id: string) => Promise<void>;
}

const InventoryContext = createContext<InventoryContextValue | undefined>(undefined);

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    void inventoryApi.list()
      .then((inventory) => {
        if (mounted) {
          setItems(inventory);
          setError(null);
        }
      })
      .catch((requestError: unknown) => {
        if (mounted) setError(requestError instanceof ApiError ? requestError.message : 'Inventory could not be loaded.');
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => { mounted = false; };
  }, [refreshKey]);

  const addItem = async (newItem: CreateInventoryItem) => {
    const item = await inventoryApi.create(newItem);
    setItems((previousItems) => [...previousItems, item]);
    return item;
  };

  const updateItem = async (id: string, updatedItem: UpdateInventoryItem) => {
    const existingItem = items.find((item) => item.id === id);
    const nextStock = updatedItem.stock ?? existingItem?.stock;
    const { stock: _stock, ...details } = updatedItem;
    const item = await inventoryApi.update(id, details);
    if (nextStock === undefined || nextStock === item.stock) {
      setItems((previousItems) => previousItems.map((current) => current.id === id ? item : current));
    } else {
      const adjustedItem = await inventoryApi.adjust(id, { quantity: nextStock - item.stock, reason: 'Inventory count correction' });
      setItems((previousItems) => previousItems.map((current) => current.id === id ? adjustedItem : current));
    }
    return item;
  };

  const deleteItem = async (id: string) => {
    await inventoryApi.remove(id);
    setItems((previousItems) => previousItems.filter((item) => item.id !== id));
  };

  return (
    <InventoryContext.Provider value={{ items, isLoading, error, refresh: () => setRefreshKey((value) => value + 1), addItem, updateItem, deleteItem }}>
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
