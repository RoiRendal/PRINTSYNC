import { Skeleton } from '../ui';
import { ImageGrid } from '../ui/ImageGrid';
import { SurfaceCard } from '../ui/Card';

export interface ImageGridSkeletonProps {
  count?: number;
  className?: string;
  /** What the placeholder is standing in for — "stock items", "designs". */
  label: string;
}

/**
 * The loading form of any image grid.
 *
 * It shares its track with the real grids (`ImageGrid`), which is the only thing
 * that keeps a placeholder honest: a placeholder built from its own copy of the
 * breakpoints loads into a grid of a different column count the moment either
 * one moves. Two hand-written copies of the same five breakpoints had already
 * appeared before this — one in the design repo, one about to be written here.
 *
 * The card body is a generic two-line bar rather than a copy of any one grid's
 * own layout. `DesignRepository` keeps its own richer skeleton for exactly that
 * reason: its card has a measured height to match (313px) and bars shaped to the
 * real content. This one is for a grid whose body is a name line and a figure
 * line, which is what the stock gallery draws.
 */
export function ImageGridSkeleton({ count = 10, className, label }: ImageGridSkeletonProps) {
  return (
    <ImageGrid className={className} role="status" aria-busy="true" aria-label={`Loading ${label}`}>
      {Array.from({ length: count }, (_, index) => (
        <SurfaceCard key={index} className="overflow-hidden p-0">
          {/* `aspect-square` is the thumbnail box in both grids, so the card is
              the height it will be rather than a guessed one. */}
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="space-y-3 p-3">
            <div className="min-w-0">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="mt-1 h-4 w-1/2" />
            </div>
            <Skeleton className="h-4 w-full" />
          </div>
        </SurfaceCard>
      ))}
    </ImageGrid>
  );
}
