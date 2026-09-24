import { useShallow } from 'zustand/react/shallow';
import { inventoryApi, type InventoryListFilters } from '../../features/inventory/api/inventoryApi';
import type { CreateInventoryItem, InventoryItem, UpdateInventoryItem } from '../../features/inventory/types';
import { createListStore } from '../../shared/store/createListStore';
import { emitDataChange } from '../../shared/store/dataEvents';

interface InventoryActions {
  addItem: (item: CreateInventoryItem) => Promise<InventoryItem>;
  updateItem: (id: string, item: UpdateInventoryItem) => Promise<InventoryItem>;
  deleteItem: (id: string) => Promise<void>;
  reset: () => void;
}

/**
 * `InventoryListFilters` is the third type argument because this store does carry
 * a filter: `setFilters({ lowStock: 1 })` narrows the list to items at or below
 * their reorder level, server-side, and the filter is re-sent on every refetch so
 * a revalidation cannot quietly widen the list back to all stock.
 */
export const useInventoryStore = createListStore<InventoryItem, InventoryActions, InventoryListFilters>({
  list: (query) => inventoryApi.list(query),
  fallbackErrorMessage: 'Inventory could not be loaded.',

  actions: ({ snapshot, mutateItems, setError }) => ({
    addItem: async (item) => {
      const created = await inventoryApi.create(item);
      mutateItems((items) => [...items, created]);
      setError(null);
      // Announce the change so derived views (dashboard stock alerts, POS
      // catalogue, analytics forecast, notifications) re-read it immediately.
      emitDataChange('inventory');
      return created;
    },

    /**
     * Inventory stock is a ledger: quantity changes must go through the
     * movements endpoint, while descriptive fields go through `PATCH`.
     */
    updateItem: async (id, item) => {
      const existing = snapshot().items.find((current) => current.id === id);
      const nextStock = item.stock ?? existing?.stock;
      const { stock: _stock, ...details } = item;

      const updated = await inventoryApi.update(id, details);
      if (nextStock === undefined || nextStock === updated.stock) {
        mutateItems((items) => items.map((current) => (current.id === id ? updated : current)));
        setError(null);
        emitDataChange('inventory');
        return updated;
      }

      const adjusted = await inventoryApi.adjust(id, {
        quantity: nextStock - updated.stock,
        reason: 'Inventory count correction',
      });
      mutateItems((items) => items.map((current) => (current.id === id ? adjusted : current)));
      setError(null);
      emitDataChange('inventory');
      return adjusted;
    },

    deleteItem: async (id) => {
      await inventoryApi.remove(id);
      mutateItems((items) => items.filter((current) => current.id !== id));
      setError(null);
      emitDataChange('inventory');
    },

    reset: () => {
      snapshot().resetList();
    },
  }),
});

/** Drop-in replacement for the removed `InventoryContext`. */
export function useInventory() {
  return useInventoryStore(
    useShallow((state) => ({
      items: state.items,
      total: state.total,
      page: state.page,
      limit: state.limit,
      isLoading: state.isLoading,
      error: state.error,
      refresh: state.refresh,
      goToPage: state.goToPage,
      /* The writer, not the filter — see the same note in `useOrders()`. */
      setFilters: state.setFilters,
      addItem: state.addItem,
      updateItem: state.updateItem,
      deleteItem: state.deleteItem,
    })),
  );
}
