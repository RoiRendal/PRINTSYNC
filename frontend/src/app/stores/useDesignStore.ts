import { useShallow } from 'zustand/react/shallow';
import { designsApi } from '../../features/designs/api/designsApi';
import type { CreateDesign, Design, UpdateDesign } from '../../features/designs/types';
import { createListStore } from '../../shared/store/createListStore';
import { emitDataChange } from '../../shared/store/dataEvents';

interface DesignActions {
  addDesign: (design: CreateDesign) => Promise<Design>;
  updateDesign: (id: string, design: UpdateDesign) => Promise<Design>;
  deleteDesign: (id: string) => Promise<void>;
  reset: () => void;
}

export const useDesignStore = createListStore<Design, DesignActions>({
  list: (query) => designsApi.list(query),
  fallbackErrorMessage: 'Designs could not be loaded.',

  actions: ({ snapshot, mutateItems, setError }) => ({
    addDesign: async (design) => {
      const created = await designsApi.create(design);
      mutateItems((items) => [created, ...items]);
      setError(null);
      emitDataChange('designs');
      return created;
    },

    /** The edit form only sends changed fields, so missing ones fall back to the cache. */
    updateDesign: async (id, design) => {
      const existing = snapshot().items.find((current) => current.id === id);
      if (!existing) throw new Error('Design not found.');

      const updated = await designsApi.update(id, {
        name: design.name ?? existing.name,
        category: design.category ?? existing.category,
        imageUrl: design.imageUrl ?? existing.imageUrl,
        tags: design.tags ?? existing.tags,
        assetType: design.assetType ?? existing.assetType,
        assetSizeBytes: design.assetSizeBytes ?? existing.assetSizeBytes,
      });
      mutateItems((items) => items.map((current) => (current.id === id ? updated : current)));
      setError(null);
      emitDataChange('designs');
      return updated;
    },

    deleteDesign: async (id) => {
      await designsApi.remove(id);
      mutateItems((items) => items.filter((current) => current.id !== id));
      setError(null);
      emitDataChange('designs');
    },

    reset: () => {
      snapshot().resetList();
    },
  }),
});

/** Drop-in replacement for the removed `DesignContext`. */
export function useDesigns() {
  return useDesignStore(
    useShallow((state) => ({
      designs: state.items,
      total: state.total,
      page: state.page,
      limit: state.limit,
      isLoading: state.isLoading,
      error: state.error,
      refresh: state.refresh,
      goToPage: state.goToPage,
      addDesign: state.addDesign,
      updateDesign: state.updateDesign,
      deleteDesign: state.deleteDesign,
    })),
  );
}
