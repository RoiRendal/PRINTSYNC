import { Plus, Search, ShoppingBag } from 'lucide-react';
import type { InventoryItem } from '../../../inventory/types';
import { Badge, Card, Input } from '../../../../shared/components/ui';
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
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <Card padding="md">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-macos-text-muted dark:text-zinc-500" aria-hidden="true" />
            <Input
              ref={searchRef}
              type="text"
              aria-label="Search catalog"
              className="pl-9 text-xs"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              autoFocus
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => onCategoryChange(cat)}
                className={cn(
                  'whitespace-nowrap rounded-full border px-3 py-1.5 text-2xs font-bold',
                  activeCategory === cat
                    ? 'border-macos-blue bg-macos-blue text-[var(--app-accent-ink)]'
                    : 'text-macos-text-muted hover:border-[var(--app-border-control)] hover:text-macos-blue dark:text-zinc-400 dark:hover:text-macos-cyan',
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </Card>

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
            <div className="relative mb-2 flex h-28 items-center justify-center overflow-hidden rounded-[0.65rem] border bg-[#f7f7f7] dark:bg-[#373739] xl:h-32">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex flex-col items-center text-macos-text-muted group-hover:text-macos-blue dark:text-zinc-600 dark:group-hover:text-macos-cyan">
                  <ShoppingBag className="h-9 w-9 stroke-1" aria-hidden="true" />
                  <span className="mt-1 text-3xs font-mono">No image</span>
                </div>
              )}
              <div className="absolute right-1.5 top-1.5">
                <Badge variant={product.stock <= product.reorderLevel ? 'red' : 'blue'} className="bg-[var(--app-surface-raised)] dark:bg-[#141416]">
                  {product.stock} stock
                </Badge>
              </div>
            </div>
            <h3 className="line-clamp-2 text-xs font-bold tracking-tight text-macos-text dark:text-zinc-100 xl:text-xs">{product.name}</h3>
            <div className="mt-2 flex items-center justify-between">
              <p className="font-mono text-2xs font-bold text-macos-text dark:text-zinc-100 xl:text-xs">{currencySymbol}{product.price.toFixed(2)}</p>
              <Plus className="h-3.5 w-3.5 text-macos-text-muted group-hover:text-macos-blue dark:text-zinc-500 dark:group-hover:text-macos-cyan" aria-hidden="true" />
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
  );
}
