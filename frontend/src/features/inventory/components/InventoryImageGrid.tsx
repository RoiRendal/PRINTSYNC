import type { ReactNode } from 'react';
import { Package, Plus, RefreshCw, Trash2 } from '../../../shared/components/ui/icons';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  ImageGrid,
  ImageGridCard,
  SearchInput,
  StatusLabel,
} from '../../../shared/components/ui';
import { formatSelectedCount } from '../../../shared/lib/selectionLabels';
import type { RowSelection } from '../../../shared/hooks/useRowSelection';
import type { InventoryItem } from '../types';

interface InventoryImageGridProps {
  items: InventoryItem[];
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onRefresh: () => void;
  onAddItem: () => void;
  onEditItem: (item: InventoryItem) => void;
  onDeleteSelected: () => void;
  selection: RowSelection;
  footer?: ReactNode;
}

/**
 * Up to two initials for a stock item with no photo — "Bond Paper" becomes BP.
 *
 * Empty when the name has no usable characters, which leaves the tile as its
 * plain fill rather than inventing a letter. A card whose name is not ASCII gets
 * a blank tile instead of a mangled one, and the name is still legible directly
 * beneath it.
 */
export function stockInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .map((part) => part[0]!)
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/**
 * The stock list drawn as a gallery — the Image View of `InventoryTable`.
 *
 * The two are the same surface in two shapes, and they are deliberately built
 * from the same parts: `ImageGrid` for the track, the shared card, and the same
 * checkbox / toolbar / delete rules the table follows. A staff member switching
 * views should recognise the screen, not learn a second one.
 *
 * The toolbar is kept because it is the only way to search, refresh or add from
 * this view — a gallery without it would be a read-only wall of pictures. It
 * carries one thing the table's does not: while rows are ticked the header shows
 * "N items selected" instead of the card count, which is how the table behaves
 * too (ERPNext collapses the whole header to that message).
 */
export function InventoryImageGrid({
  items,
  searchTerm,
  onSearchTermChange,
  onRefresh,
  onAddItem,
  onEditItem,
  onDeleteSelected,
  selection,
  footer,
}: InventoryImageGridProps) {
  return (
    <Card padding="none" className="overflow-hidden">
      <CardHeader className="mb-0 flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
        {/*
          The count is NOT reported when there is nothing to count. "0 stock
          items" beside "No stock items found" is the same fact stated twice, and
          the second one says it better — a header figure of zero reads as a
          measurement, not as an empty result. The table never had this problem
          because it has no count line; this one does, so the empty case is
          simply left to the empty state.
        */}
        {selection.count === 0 && items.length === 0 ? (
          <span aria-hidden="true" />
        ) : (
          <p className="text-2xs font-bold text-app-text-muted dark:text-zinc-500">
            {selection.count > 0
              ? formatSelectedCount(selection.count)
              : `${items.length} stock item${items.length === 1 ? '' : 's'}`}
          </p>
        )}
        {/*
          The same order the table's toolbar uses — search, refresh, delete,
          add — because it is the same row of controls and the delete square is
          only findable if it stays where the table put it.
        */}
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center md:max-w-2xl">
          <SearchInput
            className="flex-1"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
          />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={onRefresh}
            aria-label="Refresh"
            title="Refresh"
            className="shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            disabled={selection.count === 0}
            onClick={onDeleteSelected}
            aria-label={selection.count > 0 ? `Delete ${selection.count} selected stock item${selection.count === 1 ? '' : 's'}` : 'Delete selected stock items'}
            title={selection.count === 0 ? 'Tick the cards you want to delete first.' : `Delete ${selection.count} stock item${selection.count === 1 ? '' : 's'}`}
            className="shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="primary"
            size="icon"
            onClick={onAddItem}
            aria-label="Add Stock"
            title="Add Stock"
            className="shrink-0"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {items.length > 0 ? (
          <ImageGrid>
            {items.map((item) => {
              const isLowStock = item.stock <= item.reorderLevel;
              return (
                <ImageGridCard
                  key={item.id}
                  imageUrl={item.imageUrl}
                  imageAlt={item.name}
                  fallbackLabel={stockInitials(item.name)}
                  leading={
                    /*
                     * The checkbox replaces the design repo's category badge in
                     * this corner. A card cannot carry both: the badge is
                     * decorative, and the box is the only way to reach the bulk
                     * delete, so the box wins the corner.
                     *
                     * `onClick` needs stopping because the whole card opens the
                     * edit form — without it, ticking a card would also open it.
                     */
                    <span onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        checked={selection.has(item.id)}
                        onChange={() => selection.toggle(item.id)}
                        aria-label={`Select ${item.sku}`}
                      />
                    </span>
                  }
                >
                  <div
                    className="cursor-pointer"
                    onClick={() => onEditItem(item)}
                    title={`${item.name} — click to edit`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-app-ink dark:text-zinc-100">{item.name}</h3>
                        <p className="mt-1 truncate text-2xs text-app-text-muted dark:text-zinc-500">{item.sku}</p>
                      </div>
                      <StatusLabel tone="gray" className="shrink-0 text-2xs">{item.category}</StatusLabel>
                    </div>
                    {/*
                      Stock and price on one line, the stock figure carrying the
                      low-stock colour the table's own cell uses. Nothing here is
                      a button: the card is the target, exactly as a row is.
                    */}
                    <div className="flex items-baseline justify-between gap-2 border-t border-[var(--app-border-hairline)] pt-2">
                      <span className={`text-2xs font-bold tabular-nums ${isLowStock ? 'text-app-danger dark:text-red-300' : 'text-app-ink dark:text-zinc-100'}`}>
                        {item.stock} in stock
                      </span>
                      <span className="text-2xs tabular-nums text-app-text-muted dark:text-zinc-400">
                        ₱{item.price.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </ImageGridCard>
              );
            })}
          </ImageGrid>
        ) : (
          <div className="rounded-[var(--radius-card)] border border-dashed py-20">
            <EmptyState
              title="No stock items found"
              message="Try adjusting your search or add a new stock item."
              icon={<Package className="h-12 w-12 opacity-15" aria-hidden="true" />}
              className="gap-3"
            />
          </div>
        )}
      </CardContent>

      {footer ? <div className="border-t px-4 py-3">{footer}</div> : null}
    </Card>
  );
}
