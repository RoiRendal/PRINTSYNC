import { Skeleton, StatTileRow, SurfaceCard } from '../ui';
import type { StatTileRowProps } from '../ui';
import { cn } from '../../lib/cn';

const range = (count: number) => Array.from({ length: count }, (_, index) => index);

export interface TileRowSkeletonProps {
  /**
   * Same union `StatTileRow` takes, so the two can never disagree on a column
   * count. An array draws one placeholder row per entry — for a screen whose
   * tiles land in more than one row, like the Workspace, which carries the order
   * queues above the stock figures. Both rows sit inside ONE `role="status"`, so
   * a screen reader is told once that figures are loading rather than once per
   * row.
   */
  columns?: StatTileRowProps['columns'] | ReadonlyArray<StatTileRowProps['columns']>;
  className?: string;
}

/**
 * The loading form of a `StatTileRow`.
 *
 * It reuses `StatTileRow` for the grid rather than repeating `grid-cols-*`
 * literals, so the placeholder lands in exactly the columns the tiles will, and
 * the `ROW_COLUMNS` map stays the one place a column count is written down.
 *
 * Each box is a `SurfaceCard` with the tile's own `p-4` and two bars where the
 * label and the figure go. The box is drawn as an OUTLINE, not a filled
 * rectangle, because that is what a real tile is — `.surface-panel` is a 1px
 * hairline with no background — so the skeleton reads as "a row of cards is
 * coming" instead of "a row of grey blocks is coming". Bar heights are the real
 * line boxes (`label-caps` is 11px/1.5 ≈ 16px; `text-xl` is 20px on a 28px
 * line), which is what keeps the row from jumping when the figures land.
 *
 * Rows are spaced by `space-y-5`, the same rhythm the pages lay their real tile
 * rows out with, so a two-row placeholder does not collapse into a single band
 * before the figures arrive.
 */
export function TileRowSkeleton({ columns = 5, className }: TileRowSkeletonProps) {
  const rows = typeof columns === 'number' ? [columns] : columns;

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading figures"
      className={cn('space-y-5', className)}
    >
      {rows.map((row, index) => (
        <StatTileRow key={index} columns={row}>
          {range(row).map((tile) => (
            <SurfaceCard key={tile} className="h-full p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-7 w-16" />
            </SurfaceCard>
          ))}
        </StatTileRow>
      ))}
    </div>
  );
}
