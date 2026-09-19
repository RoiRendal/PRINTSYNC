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
      <Card variant="elevated" padding="md">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-macos-text-muted" aria-hidden="true" />
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
                  'mat-focus whitespace-nowrap rounded-full border px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.18em] transition-colors',
                  /*
                   * Phase 5: a physical chip, where "selected" is the *held*
                   * position rather than a raised one — a key that stays pressed
                   * in while its category is the one on screen. It keeps its own
                   * fill instead of becoming a groove, so the selection stays
                   * exactly as loud as it was.
                   *
                   * `transition-colors`, not `transition-all`: the material
                   * classes work by swapping `box-shadow`, and easing that would
                   * make the chip float into place rather than snap. A key does
                   * not ease its way down.
                   *
                   * The blue drop-glow that used to sit on the selected branch is
                   * gone. `--color-macos-blue` has been #555558 — a neutral grey
                   * — since the palette was de-Apple'd, so it had been glowing
                   * the wrong colour for two phases.
                   */
                  activeCategory === cat
                    ? 'mat-sunk border-macos-blue bg-macos-blue text-white'
                    : 'ambient amb-elevation-0 mat-press border-[var(--app-hairline)] bg-[var(--app-surface-raised)] text-macos-text-muted hover:border-macos-blue/30 hover:text-macos-blue dark:hover:text-macos-cyan',
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
              /*
               * Phase 5: the tile is a keycap. `--shadow-card` was a hand-written
               * drop shadow from the glass era; `ambient amb-elevation-0` is the
               * same depth expressed in the one physical scale the rest of the app
               * now uses, so a tile sits at the same height as every other plate on
               * the page instead of at a height of its own.
               *
               * `mat-press` is the deeper pressed state the plan asked for: holding
               * a tile sinks it into the page rather than shrinking it. `mat-focus`
               * gives it the keyboard indicator it never had — these are buttons,
               * and until now tabbing to one showed nothing at all.
               */
              'ambient amb-elevation-0 mat-press mat-focus group flex cursor-pointer flex-col rounded-[var(--radius-card)] border border-[var(--app-hairline)] bg-[var(--app-surface-raised)] p-2 text-left transition-colors hover:border-macos-blue/35 dark:hover:border-macos-blue-dark/35',
              product.stock <= 0 && 'cursor-not-allowed opacity-50 grayscale',
            )}
          >
            {/*
              The thumbnail frame becomes a well: `--app-surface` under a
              `--app-surface-raised` tile, so it reads as recessed with no literal
              needed. It replaces a hand-mixed `bg-black/[0.03] dark:bg-white/5`
              pair, which is the same two-values-kept-in-step problem the rest of
              this phase is removing.

              The groove's inset shadow is painted under child content, so on a
              tile that has a picture the image covers it and only the hairline and
              the colour step show. That matches what the frame did before, and it
              is the empty "No image" state — the one where the frame is the whole
              visual — that gains the depth.
            */}
            <div className="amb-groove mat-well relative mb-2 flex h-28 items-center justify-center overflow-hidden rounded-[0.65rem] border border-[var(--app-hairline)] xl:h-32">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex flex-col items-center text-macos-text-muted transition-colors group-hover:text-macos-blue dark:group-hover:text-macos-cyan">
                  <ShoppingBag className="h-9 w-9 stroke-1" aria-hidden="true" />
                  <span className="mt-1 text-[8px] font-mono uppercase tracking-widest">No image</span>
                </div>
              )}
              <div className="absolute right-1.5 top-1.5">
                <Badge variant={product.stock <= product.reorderLevel ? 'red' : 'blue'} className="bg-[var(--app-surface-raised)]">
                  {product.stock} stock
                </Badge>
              </div>
            </div>
            <h3 className="line-clamp-2 text-[11px] font-bold uppercase tracking-tight text-macos-text dark:text-zinc-100 xl:text-[12px]">{product.name}</h3>
            <div className="mt-2 flex items-center justify-between">
              <p className="font-mono text-[10px] font-bold text-macos-text dark:text-zinc-100 xl:text-[11px]">{currencySymbol}{product.price.toFixed(2)}</p>
              <Plus className="h-3.5 w-3.5 text-macos-text-muted group-hover:text-macos-blue dark:group-hover:text-macos-cyan" aria-hidden="true" />
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
