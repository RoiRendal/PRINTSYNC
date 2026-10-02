import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { SurfaceCard } from './Card';

/**
 * The track both image grids share — the stock gallery and the design repo.
 *
 * One column count and one gap, responsive in one place. That is the whole
 * reason this exists: the design repo's grid and the stock gallery would
 * otherwise be two copies of the same five breakpoints, and a change to one
 * would silently miss the other. The shared `Table` is the precedent — a table
 * change is made once, in the primitive, and every list picks it up.
 */
export const ImageGrid = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6',
        className,
      )}
      {...props}
    />
  ),
);

ImageGrid.displayName = 'ImageGrid';

export interface ImageGridCardProps extends HTMLAttributes<HTMLDivElement> {
  /** The photo. Empty, null and undefined all fall through to `fallbackLabel`. */
  imageUrl?: string | null;
  /** Alt text for the photo — the item's name, not a description of the file. */
  imageAlt: string;
  /**
   * What stands in for a photo that is not there: a stock item with no picture
   * shows its initials. Without it the tile is just the flat fill, which is
   * right for a card whose body already names the item.
   */
  fallbackLabel?: string;
  /**
   * Pinned to the top-left of the photo. The design repo puts its category badge
   * here, the stock gallery puts its select box. Both render into one row, so a
   * card carrying both lays them out side by side instead of stacking them on
   * the same corner.
   */
  leading?: ReactNode;
  /**
   * Spread across the whole photo and revealed on hover — the design repo's
   * View / Download pair. It appears at once rather than easing in: the gate
   * allows nothing that changes a value over time, and the pointer is already
   * on the card by the moment it shows.
   */
  overlay?: ReactNode;
  /** The card's body — title, meta, actions. Entirely the caller's. */
  children?: ReactNode;
}

/**
 * One tile: a square photo over the caller's own body.
 *
 * The card owns the shape and nothing else. Everything that differs between the
 * design repo and the stock gallery — the badge, the hover actions, what the
 * body says — arrives as a slot, which is what keeps a change here a change to
 * both grids at once rather than a decision that only one of them agreed to.
 */
export const ImageGridCard = forwardRef<HTMLDivElement, ImageGridCardProps>(
  ({ className, imageUrl, imageAlt, fallbackLabel, leading, overlay, children, ...props }, ref) => {
    const hasImage = typeof imageUrl === 'string' && imageUrl.trim().length > 0;

    return (
      <SurfaceCard ref={ref} className={cn('group overflow-hidden p-0', className)} {...props}>
        {/*
          The fill is the state-hover token, and it needs no `dark:` twin: the
          custom property is redeclared inside `.dark`, so this one class already
          resolves to the right value in both themes. The design repo's card
          spelled the pair out; the second class was reading the same variable.
        */}
        <div className="relative aspect-square overflow-hidden bg-[var(--app-state-hover)]">
          {hasImage ? (
            <img src={imageUrl} alt={imageAlt} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              {/* Decorative: the body below carries the item's name, so the
                  initials would only repeat it to a screen reader. */}
              <span
                aria-hidden="true"
                className="text-2xl font-bold text-app-text-muted dark:text-zinc-500"
              >
                {fallbackLabel}
              </span>
            </div>
          )}
          {overlay ? (
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-[var(--app-scrim)] opacity-0 group-hover:opacity-100">
              {overlay}
            </div>
          ) : null}
          {leading ? <div className="absolute left-2 top-2 flex items-center gap-2">{leading}</div> : null}
        </div>
        {children ? <div className="space-y-3 p-3">{children}</div> : null}
      </SurfaceCard>
    );
  },
);

ImageGridCard.displayName = 'ImageGridCard';
