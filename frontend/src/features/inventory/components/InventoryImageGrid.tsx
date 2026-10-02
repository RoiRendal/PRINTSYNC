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
  ViewSelect,
} from '../../../shared/components/ui';
import type { ViewShape } from '../../../shared/components/ui';
import { TOOLBAR_ROW_CLASS, TOOLBAR_SEARCH_WIDTH_CLASS } from '../../../shared/lib/toolbar';
import { thumbnailUrl } from '../../../shared/lib/thumbnail';
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
  /** Which shape this gallery is currently drawn in. */
  view: ViewShape;
  onViewChange: (view: ViewShape) => void;
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
 * this view — a gallery without it would be a read-only wall of pictures. The
 * header is the table's header, one row and no count: both shapes name the same
 * controls in the same order, so only the body changes between them.
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
  view,
  onViewChange,
  footer,
}: InventoryImageGridProps) {
  return (
    <Card padding="none" className="overflow-hidden">
      <CardHeader className="mb-0 border-b p-4">
        {/*
          One row, no count line.

          The gallery used to open with a count ("15 stock items", or "N items
          selected" while rows were ticked). That number is the pager's job —
          "Page 1 of 2 (15 total)" already reports it at the foot of the same
          card — and the table view never had the line at all. Two shapes of the
          same surface disagreeing about their own header is the kind of drift
          that makes a view switch feel like a different screen, so the line is
          gone and this header now matches the table's exactly.
        */}
        {/*
          The same order the table's toolbar uses — search, refresh, delete,
          add — because it is the same row of controls and the delete square is
          only findable if it stays where the table put it.
        */}
        <div className={TOOLBAR_ROW_CLASS}>
          {/* Leading edge of the toolbar row, left of the search box — the same
              position the table puts it in, so the two shapes read alike. */}
          <ViewSelect value={view} onChange={onViewChange} ariaLabel="Stock view" />
          <SearchInput
            className={TOOLBAR_SEARCH_WIDTH_CLASS}
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
                  /*
                    The card draws a ~215px box, so it asks Storage for a 400px
                    copy rather than the original — measured at 21.8 MP across
                    these 15 tiles before, with sources up to 2000×3000. The
                    stored object is untouched; only the URL differs, so this
                    applies to photos uploaded before it existed too.
                  */
                  imageUrl={thumbnailUrl(item.imageUrl)}
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
