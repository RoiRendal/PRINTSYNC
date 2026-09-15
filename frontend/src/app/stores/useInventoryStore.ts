import { useShallow } from 'zustand/react/shallow';
import { inventoryApi } from '../../features/inventory/api/inventoryApi';
import type { CreateInventoryItem, InventoryItem, UpdateInventoryItem } from '../../features/inventory/types';
import { createListStore } from '../../shared/store/createListStore';

interface InventoryActions {
  addItem: (item: CreateInventoryItem) => Promise<InventoryItem>;
  updateItem: (id: string, item: UpdateInventoryItem) => Promise<InventoryItem>;
  deleteItem: (id: string) => Promise<void>;
  reset: () => void;
}

export const useInventoryStore = createListStore<InventoryItem, InventoryActions>({
  list: (query) => inventoryApi.list(query),
  fallbackErrorMessage: 'Inventory could not be loaded.',

  actions: ({ snapshot, mutateItems, setError }) => ({
    addItem: async (item) => {
      const created = await inventoryApi.create(item);
      mutateItems((items) => [...items, created]);
      setError(null);
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
        return updated;
      }

      const adjusted = await inventoryApi.adjust(id, {
        quantity: nextStock - updated.stock,
        reason: 'Inventory count correction',
      });
      mutateItems((items) => items.map((current) => (current.id === id ? adjusted : current)));
      setError(null);
      return adjusted;
    },

    deleteItem: async (id) => {
      await inventoryApi.remove(id);
      mutateItems((items) => items.filter((current) => current.id !== id));
      setError(null);
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
      addItem: state.addItem,
      updateItem: state.updateItem,
      deleteItem: state.deleteItem,
    })),
  );
}
