import { ShoppingBag } from '../../../../shared/components/ui/icons';
import type { InventoryItem } from '../../../inventory/types';
import { CardContent, CardHeader, SearchInput, SurfaceCard } from '../../../../shared/components/ui';
import { EmptyState } from '../../../../shared/components/feedback/EmptyState';
import { cn } from '../../../../shared/lib/cn';

import type { RefObject } from 'react';

interface POSCatalogProps {
  inventory: InventoryItem[];
  filteredProducts: InventoryItem[];
  categories: string[];
  searchTerm: string;
  activeCategory: string;
  currencySymbol: string;
  searchRef?: RefObject<HTMLInputElement | null>;
  onSearchChange: (value: string) => void;
  onCategoryChange: (category: string) => void;
  onAddToCart: (product: InventoryItem) => void;
}

export function POSCatalog({
  filteredProducts,
  categories,
  searchTerm,
  activeCategory,
  currencySymbol,
  searchRef,
  onSearchChange,
  onCategoryChange,
  onAddToCart,
}: POSCatalogProps) {
  /*
   * ONE panel, not two — ERPNext's `.items-selector` is a single card whose
   * header carries the search and the item-group filter and whose body is the
   * item grid. It used to be a floating search card and then a loose grid
   * beneath it, which read as two surfaces and let the scroll live on the page
   * instead of on the list.
   *
   * Fixed-height from `xl` up: the header keeps its natural height and the grid
   * takes what is left and scrolls. Below `xl` the panels stack, so both keep
   * their natural height (`shrink-0`) and the page-level container scrolls.
   */
  return (
    <SurfaceCard padding="none" className="flex min-h-0 min-w-0 shrink-0 flex-col overflow-hidden xl:shrink">
      <CardHeader className="mb-0 shrink-0 flex-col gap-3 border-b border-[var(--app-border-hairline)] p-3 lg:flex-row lg:items-center">
        <SearchInput
          ref={searchRef}
          aria-label="Search catalog"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          autoFocus
          className="lg:w-56 xl:w-64"
        />

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => onCategoryChange(cat)}
              className={cn(
                'whitespace-nowrap rounded-full border px-3 py-1.5 text-2xs font-bold',
                // Active category: the grey "selected" step, matching the
                // status chips and the segmented control. Border keeps its 1px
                // box but takes the fill's colour, so only the hue changes.
                activeCategory === cat
                  ? 'border-[var(--app-state-hover-sub)] bg-[var(--app-state-hover-sub)] text-app-ink dark:text-zinc-100'
                  : 'text-app-text-muted hover:border-[var(--app-border-control)] hover:text-app-accent dark:text-zinc-400 dark:hover:text-app-accent-soft',
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </CardHeader>

      {/*
        The grid is the catalog's scroll owner, so the search box and the
        category row stay put while the tiles move — the two controls you reach
        for most were the two that used to leave the screen first.
      */}
      <CardContent className="scrollbar-thin p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {filteredProducts.map(product => (
          <button
            key={product.id}
            type="button"
            onClick={() => onAddToCart(product)}
            disabled={product.stock <= 0}
            className={cn(
              'group flex cursor-pointer flex-col rounded-[var(--radius-card)] border p-2 text-left hover:border-[var(--app-border-control)]',
              product.stock <= 0 && 'cursor-not-allowed opacity-50 grayscale',
            )}
          >
            <div className="relative mb-2 flex h-28 items-center justify-center overflow-hidden rounded-[0.65rem] border bg-[var(--app-state-hover)] dark:bg-[var(--app-state-hover)] xl:h-32">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex flex-col items-center text-app-text-muted group-hover:text-app-accent dark:text-zinc-600 dark:group-hover:text-app-accent-soft">
                  <ShoppingBag className="h-9 w-9 stroke-1" aria-hidden="true" />
                  <span className="mt-1 text-3xs">No image</span>
                </div>
              )}
              {/*
                A bare number, toned by threshold — ERPNext's `.item-qty-available`.
                It used to be a `Badge` pill reading "15 stock", which spent a
                frame, a fill and a word on one fact. The word went too: every
                other number in this column is a quantity, so the tile does not
                need to say which one.

                At or under the reorder level it goes red. That is the same
                deliberate exception the inventory table and the dashboard
                low-stock count already use — here the number is the only place
                the cashier sees that this item is about to run out.
              */}
              <span
                className={cn(
                  'absolute right-1.5 top-1.5 tabular-nums text-2xs font-bold',
                  product.stock <= product.reorderLevel
                    ? 'text-app-danger dark:text-red-300'
                    : 'text-app-text-muted dark:text-zinc-400',
                )}
              >
                {product.stock}
              </span>
            </div>
            <h3 className="line-clamp-2 text-xs font-bold tracking-tight text-app-ink dark:text-zinc-100 xl:text-xs">{product.name}</h3>
            {/*
              Three cues: image, name, price. The `+` glyph is gone — the whole
              tile is already the button, so the plus was a second affordance
              pointing at the first one. ERPNext's tile carries no add control
              either.
            */}
            <p className="mt-2 tabular-nums text-2xs font-bold text-app-ink dark:text-zinc-100 xl:text-xs">{currencySymbol}{product.price.toFixed(2)}</p>
          </button>
        ))}
        {filteredProducts.length === 0 && (
          <div className="col-span-full py-12">
            <EmptyState title="No catalog items found" message="Adjust the search or category filter to find printable stock." />
          </div>
        )}
      </div>
      </CardContent>
    </SurfaceCard>
  );
}
