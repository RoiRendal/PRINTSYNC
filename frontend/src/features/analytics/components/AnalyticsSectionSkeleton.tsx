import { Skeleton, SurfaceCard } from '../../../shared/components/ui';
import { ChartSkeleton } from '../../../shared/components/feedback/ChartSkeleton';
import type { ChartSkeletonProps } from '../../../shared/components/feedback/ChartSkeleton';
import { TileRowSkeleton } from '../../../shared/components/feedback/TileRowSkeleton';

export interface AnalyticsSectionSkeletonProps {
  /** The chart panel's own height, so the section is the height it will be. */
  chartHeight?: ChartSkeletonProps['height'];
}

/**
 * The loading form of an analytics section body.
 *
 * All four chart sections build the same three things in the same order — the
 * `InsightPanel`, a four-tile row, then the chart — so the placeholder is one
 * component with one number that differs, rather than four near-identical
 * copies. That is also why it lives in `features/analytics/components` and not
 * in `shared/`: it knows the shape of `InsightPanel`, which is an analytics
 * panel, exactly as `SectionCard` does. `shared/` gets the two shapes that carry
 * no domain knowledge — the tile row and the chart block.
 *
 * The InsightPanel's controls row is real chrome that a placeholder cannot
 * invent: a checkbox, a button, and a line of "last generated" text. What is
 * left to draw is their footprint — a label bar and a 24px button box (the real
 * `Button size="sm"` height) — so the card keeps its own height instead of
 * collapsing and pushing the chart up.
 */
export function AnalyticsSectionSkeleton({ chartHeight = 390 }: AnalyticsSectionSkeletonProps) {
  return (
    <>
      <SurfaceCard className="mt-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-6 w-36" />
        </div>
        <Skeleton className="mt-2 h-3 w-32" />
        <Skeleton className="mt-4 h-3 w-2/3" />
      </SurfaceCard>

      <div className="my-4">
        <TileRowSkeleton columns={4} />
      </div>

      <ChartSkeleton height={chartHeight} />
    </>
  );
}
