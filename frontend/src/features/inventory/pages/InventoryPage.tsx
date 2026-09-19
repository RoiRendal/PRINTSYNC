import { useState } from 'react';
import { AlertTriangle, Box, Image as ImageIcon } from 'lucide-react';
import { DesignRepository } from '../../designs/components/DesignRepository';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { cn } from '../../../shared/lib/cn';
import { DeleteConfirmModal, InventoryFormModal } from '../components/InventoryFormModal';
import { InventoryStats } from '../components/InventoryStats';
import { InventoryTable } from '../components/InventoryTable';
import { useFilteredInventory } from '../hooks/useFilteredInventory';
import { useInventory } from '../../../app/stores/useInventoryStore';
import { Pagination } from '../../../shared/components/ui';
import { ApiError } from '../../../shared/api/errors';
import type { CreateInventoryItem, InventoryItem } from '../types';

export default function Inventory() {
  const { items, total, page, limit, isLoading, error, refresh, goToPage, addItem, updateItem, deleteItem } = useInventory();
  const [viewMode, setViewMode] = useState<'inventory' | 'designs'>('inventory');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const { filteredItems, categories, inventoryStats } = useFilteredInventory(items, searchTerm);

  const handleOpenModal = (item?: InventoryItem) => {
    setEditingItem(item ?? null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleSubmit = async (formData: CreateInventoryItem) => {
    setMutationError(null);
    try {
      if (editingItem) {
        await updateItem(editingItem.id, formData);
      } else {
        await addItem(formData);
      }
      handleCloseModal();
    } catch (error: unknown) {
      setMutationError(error instanceof ApiError ? error.message : 'The inventory item could not be saved.');
    }
  };

  const handleDeleteInitiate = (item: InventoryItem) => {
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setMutationError(null);
    try {
      await deleteItem(itemToDelete.id);
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    } catch (error: unknown) {
      setMutationError(error instanceof ApiError ? error.message : 'The inventory item could not be deleted.');
      setIsDeleteModalOpen(false);
    }
  };

  if (isLoading) return <LoadingState label="Loading inventory" className="min-h-64" />;
  if (error) return <ErrorState message={error} onRetry={refresh} className="min-h-64" />;

  return (
    <div className="space-y-5">
      {mutationError && (
        <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-macos-red/20 bg-macos-red/10 p-3 text-xs font-medium text-red-700 dark:border-macos-red/25 dark:bg-macos-red/15 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{mutationError}</span>
          <button type="button" onClick={() => setMutationError(null)} className="ml-auto text-red-500 hover:text-red-700 dark:text-red-300 dark:hover:text-red-200">Dismiss</button>
        </div>
      )}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>

          <h1 className="text-2xl font-bold tracking-tight text-macos-text dark:text-zinc-100 lg:text-[28px]">Inventory Management</h1>
          <p className="mt-1 text-sm text-macos-text-muted">
            {viewMode === 'inventory' ? 'Manage raw materials, reorder thresholds, and stock valuation.' : 'Digital asset library for custom apparel designs.'}
          </p>
        </div>

        <div className="surface-segmented flex items-center rounded-full p-1">
          <button
            type="button"
            onClick={() => setViewMode('inventory')}
            className={cn('mat-focus flex h-8 cursor-pointer items-center gap-2 rounded-full px-4 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors', viewMode === 'inventory' ? 'mat-selected-segment bg-segment-grey text-white' : 'ambient amb-elevation-0 mat-press text-macos-text-muted hover:text-macos-text dark:hover:text-zinc-100')}
            aria-pressed={viewMode === 'inventory'}
          >
            <Box className="h-3.5 w-3.5" aria-hidden="true" /> Stock List
          </button>
          <button
            type="button"
            onClick={() => setViewMode('designs')}
            className={cn('mat-focus flex h-8 cursor-pointer items-center gap-2 rounded-full px-4 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors', viewMode === 'designs' ? 'mat-selected-segment bg-segment-purple text-white' : 'ambient amb-elevation-0 mat-press text-macos-text-muted hover:text-macos-text dark:hover:text-zinc-100')}
            aria-pressed={viewMode === 'designs'}
          >
            <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" /> Design Repo
          </button>
        </div>
      </div>

      {viewMode === 'inventory' ? (
        <div className="space-y-4">
          <InventoryStats stats={inventoryStats} />

          <InventoryTable
            items={filteredItems}
            totalCount={items.length}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            onAddItem={() => handleOpenModal()}
            onEditItem={(item) => handleOpenModal(item)}
            onDeleteItem={handleDeleteInitiate}
          />
          <Pagination page={page} limit={limit} total={total} onPageChange={goToPage} />
        </div>
      ) : (
        <DesignRepository />
      )}

      <InventoryFormModal
        isOpen={isModalOpen}
        editingItem={editingItem}
        categories={categories}
        mutationError={mutationError}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        item={itemToDelete}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
