import { useEffect, useMemo, useState } from 'react';
import { Box, Image as ImageIcon } from '../../../shared/components/ui/icons';
import { InlineAlert } from '../../../shared/components/feedback/InlineAlert';
import { DesignRepository } from '../../designs/components/DesignRepository';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { TableSkeleton } from '../../../shared/components/feedback/TableSkeleton';
import { cn } from '../../../shared/lib/cn';
import { InventoryFormModal } from '../components/InventoryFormModal';
import { InventoryStats } from '../components/InventoryStats';
import { InventoryTable } from '../components/InventoryTable';
import { useFilteredInventory } from '../hooks/useFilteredInventory';
import { useInventory } from '../../../app/stores/useInventoryStore';
import { useUrlFilter } from '../../../shared/hooks/useUrlFilter';
import { useRowSelection } from '../../../shared/hooks/useRowSelection';
import { DeleteConfirmModal, Pagination, SegmentedControl } from '../../../shared/components/ui';
import { ApiError } from '../../../shared/api/errors';
import type { CreateInventoryItem, InventoryItem } from '../types';

export default function Inventory() {
  const { items, total, page, limit, isLoading, error, refresh, goToPage, addItem, updateItem, deleteItem, setFilters } = useInventory();
  const [viewMode, setViewMode] = useState<'inventory' | 'designs'>('inventory');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemsToDelete, setItemsToDelete] = useState<InventoryItem[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  // The URL is the one source of truth for the low-stock filter. `lowStock=1`
  // is the key the server understands; clearing deletes the param.
  const [lowStockParam, setLowStockParam] = useUrlFilter('lowStock', '');
  const lowStockOnly = lowStockParam === '1';
  /*
   * Keep the server-side filter in step with the URL. Keyed on `lowStockOnly`
   * (derived from the URL), so it fires once on arrival and once per real URL
   * change — never on every render. `setFilters` has no equality guard, so
   * calling it from a render loop would refetch the list in a storm; this does not.
   */
  useEffect(() => {
    setFilters(lowStockOnly ? { lowStock: 1 } : {});
  }, [lowStockOnly, setFilters]);

  const { filteredItems, categories, inventoryStats } = useFilteredInventory(items, searchTerm);

  /*
   * Tick state lives on the page. The rows on offer are the filtered ones, so a
   * row hidden by the search box or by the low-stock filter cannot be deleted by
   * accident — see `useRowSelection` for why that intersection is the point.
   */
  const selection = useRowSelection(useMemo(() => filteredItems.map((item) => item.id), [filteredItems]));

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

  const handleDeleteSelected = () => {
    const targets = filteredItems.filter((item) => selection.selectedIds.has(item.id));
    if (targets.length === 0) return;
    setItemsToDelete(targets);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (itemsToDelete.length === 0 || isDeleting) return;
    const targets = itemsToDelete;
    setMutationError(null);
    setIsDeleting(true);
    /*
     * One row at a time: `deleteItem` is a single-row endpoint, and a bulk route
     * would be a backend change this screen does not need. Whatever fails is
     * reported by SKU rather than by count — the rows that did delete have
     * already left the list, so their ticks go with them and the rest can simply
     * be retried.
     */
    const failed: string[] = [];
    try {
      for (const item of targets) {
        try {
          await deleteItem(item.id);
        } catch {
          failed.push(item.sku);
        }
      }
    } finally {
      // A throw between here and the close below would otherwise leave Confirm
      // spinning on a dialog that never goes away.
      setIsDeleting(false);
    }
    setIsDeleteModalOpen(false);
    setItemsToDelete([]);
    selection.clear();

    if (failed.length > 0) {
      setMutationError(
        `${failed.length} of ${targets.length} stock items could not be deleted: ${failed.join(', ')}.`,
      );
    }
  };

  if (isLoading) return <TableSkeleton columns={5} className="min-h-64" />;
  if (error) return <ErrorState message={error} onRetry={refresh} className="min-h-64" />;

  return (
    <div className="space-y-5">
      {mutationError && (
        <InlineAlert message={mutationError} onDismiss={() => setMutationError(null)} />
      )}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <SegmentedControl
          aria-label="Inventory view"
          value={viewMode}
          onChange={setViewMode}
          options={[
            { value: 'inventory', label: 'Stock List', icon: <Box className="h-3.5 w-3.5" aria-hidden="true" /> },
            { value: 'designs', label: 'Design Repo', icon: <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" /> },
          ]}
        />
      </div>

      {viewMode === 'inventory' ? (
        <div className="space-y-4">
          <InventoryStats stats={inventoryStats} />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setLowStockParam(lowStockOnly ? '' : '1')}
              aria-pressed={lowStockOnly}
              className={cn(
                'cursor-pointer rounded-full px-3 py-1.5 text-2xs font-bold',
                lowStockOnly
                  ? 'bg-[var(--app-state-hover-sub)] text-app-ink dark:text-zinc-100'
                  : 'border text-app-text-muted hover:bg-[var(--app-state-hover)] hover:text-app-ink dark:text-zinc-400 dark:hover:bg-[var(--app-tint-neutral)] dark:hover:text-zinc-200',
              )}
            >
              Low stock only
            </button>
          </div>

          {/*
            The footer is handed over only when there is more than one page: the
            band belongs to the pager, so passing an empty one would leave a stray
            strip under the last row.
          */}
          <InventoryTable
            items={filteredItems}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            onRefresh={refresh}
            onAddItem={() => handleOpenModal()}
            onEditItem={(item) => handleOpenModal(item)}
            onDeleteSelected={handleDeleteSelected}
            selection={selection}
            footer={total > limit ? <Pagination page={page} limit={limit} total={total} onPageChange={goToPage} /> : undefined}
          />
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
        itemLabels={itemsToDelete.map((item) => item.name)}
        isBusy={isDeleting}
        onClose={() => { setIsDeleteModalOpen(false); setItemsToDelete([]); }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
