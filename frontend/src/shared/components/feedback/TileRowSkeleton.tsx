import { Skeleton, StatTileRow, SurfaceCard } from '../ui';
import type { StatTileRowProps } from '../ui';

const range = (count: number) => Array.from({ length: count }, (_, index) => index);

export interface TileRowSkeletonProps {
  /** Same union `StatTileRow` takes, so the two can never disagree on a column count. */
  columns?: StatTileRowProps['columns'];
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
 */
export function TileRowSkeleton({ columns = 5, className }: TileRowSkeletonProps) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading figures" className={className}>
      <StatTileRow columns={columns}>
        {range(columns).map((tile) => (
          <SurfaceCard key={tile} className="h-full p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-7 w-16" />
          </SurfaceCard>
        ))}
      </StatTileRow>
    </div>
  );
}
