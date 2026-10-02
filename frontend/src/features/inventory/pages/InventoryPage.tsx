import { useEffect, useMemo, useState } from 'react';
import { InlineAlert } from '../../../shared/components/feedback/InlineAlert';
import { DesignRepository } from '../../designs/components/DesignRepository';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { ImageGridSkeleton } from '../../../shared/components/feedback/ImageGridSkeleton';
import { TableSkeleton } from '../../../shared/components/feedback/TableSkeleton';
import { cn } from '../../../shared/lib/cn';
import { InventoryFormModal } from '../components/InventoryFormModal';
import { InventoryImageGrid } from '../components/InventoryImageGrid';
import { InventoryStats } from '../components/InventoryStats';
import { InventoryTable } from '../components/InventoryTable';
import { useFilteredInventory } from '../hooks/useFilteredInventory';
import { useInventory } from '../../../app/stores/useInventoryStore';
import { useUrlFilter } from '../../../shared/hooks/useUrlFilter';
import { useRefocusOnChange } from '../../../shared/hooks/useRefocusOnChange';
import { useRowSelection } from '../../../shared/hooks/useRowSelection';
import { DeleteConfirmModal, Pagination, SegmentedControl, parseViewShape } from '../../../shared/components/ui';
import type { ViewShape } from '../../../shared/components/ui';
import { ApiError } from '../../../shared/api/errors';
import type { CreateInventoryItem, InventoryItem } from '../types';

/**
 * Which shape the stock list is drawn in.
 *
 * `list` is the table this screen has always had, `image` is the gallery. Only
 * the stock surface is switchable here — the design repo's own view is chosen on
 * its screen (P4), so this param says nothing about it.
 */
const DEFAULT_STOCK_VIEW: ViewShape = 'list';

export default function Inventory() {
  const { items, total, page, limit, isLoading, error, refresh, goToPage, addItem, updateItem, deleteItem, setFilters } = useInventory();
  /*
   * Which SURFACE is showing — the stock list or the design repository. In the
   * URL for the same reason the view is: without it, a refresh drops you back
   * on the stock list and a shared `?designView=list` link opens the wrong
   * screen entirely, because each surface's own view param is meaningless
   * unless the surface that reads it is also the one on screen.
   *
   * `inventory` is the default and clears the param, so `/inventory` stays clean.
   */
  const [surfaceParam, setSurfaceParam] = useUrlFilter('surface', 'inventory');
  const viewMode: 'inventory' | 'designs' = surfaceParam === 'designs' ? 'designs' : 'inventory';
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemsToDelete, setItemsToDelete] = useState<InventoryItem[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  /*
   * The chosen view lives in the URL (D3), so a refresh keeps it, Back returns
   * to the previous one, and a link can say which shape it opens in. The default
   * is `list`, and picking it CLEARS the param rather than storing `?view=list`
   * — `useUrlFilter` deletes on its clear value, so the common case stays a
   * clean `/inventory` exactly as it does for the low-stock filter below.
   *
   * An unrecognised value falls back to the default instead of rendering an
   * empty screen: `?view=gallery` from a stale bookmark should show the table,
   * not nothing.
   */
  // The clear value IS the default, so choosing the default removes the param
  // rather than storing `?stockView=list`. `useUrlFilter` deletes on its clear
  // value, so the two must be the same string or the URL collects noise.
  const [stockViewParam, setStockViewParam] = useUrlFilter('stockView', DEFAULT_STOCK_VIEW);
  const stockView = parseViewShape(stockViewParam, DEFAULT_STOCK_VIEW);

  // Switching shape unmounts the toolbar that held the picker, so focus is
  // restored to the rebuilt one. See the hook for why it cannot live in the
  // dropdown itself.
  useRefocusOnChange('button[aria-label="Stock view"]', stockView);

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

  /*
   * Built once and handed to whichever view is showing. Both render it inside
   * their own card footer, so the band sits in the same place in either shape.
   */
  const pager = total > limit
    ? <Pagination page={page} limit={limit} total={total} onPageChange={goToPage} />
    : undefined;

  /*
   * The loading placeholder matches the shape the user is about to get, so
   * `?stockView=image` does not flash a table before the gallery arrives. Both
   * fill the same reserved height, so the swap does not jump the page.
   */
  /*
   * The loading and error guards belong to the SURFACE they guard.
   *
   * `isLoading` and `error` are the *inventory* store's, and this used to
   * return them for both surfaces — so refreshing the design repository drew
   * eight rows of table skeleton over a screen about to become a grid of
   * pictures, and an inventory error blanked the repository that had caused it.
   * `DesignRepository` owns its own store, its own skeleton (measured to its
   * card's 313px) and its own error state, and is left to draw them.
   */
  if (viewMode === 'inventory') {
    if (isLoading) {
      return stockView === 'image'
        ? <ImageGridSkeleton label="stock items" className="min-h-64" />
        : <TableSkeleton columns={5} className="min-h-64" />;
    }
    if (error) return <ErrorState message={error} onRetry={refresh} className="min-h-64" />;
  }

  return (
    <div className="space-y-5">
      {mutationError && (
        <InlineAlert message={mutationError} onDismiss={() => setMutationError(null)} />
      )}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <SegmentedControl
          aria-label="Inventory view"
          value={viewMode}
          // `useUrlFilter` deletes on its clear value, so passing the default
          // back is what clears the param — passing '' would store `?surface=`.
          onChange={setSurfaceParam}
          options={[
            { value: 'inventory', label: 'Stocks' },
            { value: 'designs', label: 'Designs' },
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

            Both shapes are handed the SAME props — the same filtered items, the
            same search term, the same `selection` object and the same pager — so
            switching views cannot silently drop a filter, reset a tick, or
            change which page is showing. The only thing that differs is the
            component, which is the whole point of the pair.
          */}
          {stockView === 'image' ? (
            <InventoryImageGrid
              items={filteredItems}
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm}
              onRefresh={refresh}
              onAddItem={() => handleOpenModal()}
              onEditItem={(item) => handleOpenModal(item)}
              onDeleteSelected={handleDeleteSelected}
              selection={selection}
              view={stockView}
              onViewChange={setStockViewParam}
              footer={pager}
            />
          ) : (
            <InventoryTable
              items={filteredItems}
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm}
              onRefresh={refresh}
              onAddItem={() => handleOpenModal()}
              onEditItem={(item) => handleOpenModal(item)}
              onDeleteSelected={handleDeleteSelected}
              selection={selection}
              view={stockView}
              onViewChange={setStockViewParam}
              footer={pager}
            />
          )}
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
