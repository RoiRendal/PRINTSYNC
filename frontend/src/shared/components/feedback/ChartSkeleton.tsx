import { Skeleton } from '../ui';
import { cn } from '../../lib/cn';

/**
 * The four chart heights the analytics sections actually use. A literal map, not
 * an interpolated class — Tailwind reads source text, so `h-[${n}px]` would
 * never be generated and the block would silently collapse. Same reason
 * `StatTileRow` carries `ROW_COLUMNS` as a map instead of building a string.
 */
const CHART_HEIGHTS = {
  340: 'h-[340px]',
  360: 'h-[360px]',
  380: 'h-[380px]',
  390: 'h-[390px]',
} as const;

export interface ChartSkeletonProps {
  /** Matches the `h-[Npx]` the real chart wrapper uses. */
  height?: keyof typeof CHART_HEIGHTS;
  className?: string;
}

/**
 * The loading form of a chart panel.
 *
 * Deliberately one block and not a drawing of a chart. An axis-and-series
 * outline would be a guess about data that has not arrived, and the four
 * analytics panels draw three different chart types — a guess would be wrong for
 * at least two of them and would read as a broken chart rather than as a wait.
 * The wrapper carries the real `h-[Npx] w-full min-w-0` so the panel is the
 * height it will be.
 */
export function ChartSkeleton({ height = 390, className }: ChartSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading chart"
      className={cn('w-full min-w-0', CHART_HEIGHTS[height], className)}
    >
      <Skeleton className="h-full w-full" />
    </div>
  );
}
