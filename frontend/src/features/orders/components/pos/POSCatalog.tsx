import { Plus, ShoppingBag } from '../../../../shared/components/ui/icons';
import type { InventoryItem } from '../../../inventory/types';
import { Badge, Card, SearchInput } from '../../../../shared/components/ui';
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
   * A fixed-height panel from `xl` up: the search header keeps its natural
   * height and the item grid takes what is left and scrolls. Below `xl` the two
   * panels stack instead, so both keep their natural height (`shrink-0`) and the
   * page-level container is the thing that scrolls.
   */
  return (
    <div className="flex min-h-0 min-w-0 shrink-0 flex-col gap-3 xl:shrink">
      <Card padding="md" className="shrink-0">
        <div className="flex flex-col gap-3">
          <SearchInput
            ref={searchRef}
            aria-label="Search catalog"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            autoFocus
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
        </div>
      </Card>

      {/*
        The grid is the catalog's scroll owner. It used to be the page that
        scrolled, which meant the search box and the category row scrolled away
        with the items — the two controls you reach for most were the two that
        left the screen first.
      */}
      <div className="scrollbar-thin xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
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
              <div className="absolute right-1.5 top-1.5">
                <Badge variant={product.stock <= product.reorderLevel ? 'red' : 'accent'} className="bg-[var(--app-surface-raised)] dark:bg-[#141416]">
                  {product.stock} stock
                </Badge>
              </div>
            </div>
            <h3 className="line-clamp-2 text-xs font-bold tracking-tight text-app-ink dark:text-zinc-100 xl:text-xs">{product.name}</h3>
            <div className="mt-2 flex items-center justify-between">
              <p className="tabular-nums text-2xs font-bold text-app-ink dark:text-zinc-100 xl:text-xs">{currencySymbol}{product.price.toFixed(2)}</p>
              <Plus className="h-3.5 w-3.5 text-app-text-muted group-hover:text-app-accent dark:text-zinc-500 dark:group-hover:text-app-accent-soft" aria-hidden="true" />
            </div>
          </button>
        ))}
        {filteredProducts.length === 0 && (
          <div className="col-span-full py-12">
            <EmptyState title="No catalog items found" message="Adjust the search or category filter to find printable stock." />
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
