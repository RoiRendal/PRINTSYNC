import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { inventoryApi } from '../api/inventoryApi';
import { ApiError } from '../../../shared/api/errors';
import type { CreateInventoryItem, InventoryItem, UpdateInventoryItem } from '../types';

interface InventoryContextValue {
  items: InventoryItem[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  goToPage: (page: number) => void;
  addItem: (item: CreateInventoryItem) => Promise<InventoryItem>;
  updateItem: (id: string, item: UpdateInventoryItem) => Promise<InventoryItem>;
  deleteItem: (id: string) => Promise<void>;
}

const InventoryContext = createContext<InventoryContextValue | undefined>(undefined);

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    void inventoryApi.list({ page, limit })
      .then((response) => {
        if (mounted) {
          setItems(response.data);
          setTotal(response.total);
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
  }, [refreshKey, page, limit]);

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

  const goToPage = (nextPage: number) => setPage(Math.max(1, nextPage));
  const refresh = () => setRefreshKey((value) => value + 1);

  return (
    <InventoryContext.Provider value={{ items, total, page, limit, isLoading, error, refresh, goToPage, addItem, updateItem, deleteItem }}>
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
