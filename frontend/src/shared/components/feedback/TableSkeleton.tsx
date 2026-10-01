import {
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableSelectCell,
  TableSelectHead,
} from '../ui';

const range = (count: number) => Array.from({ length: count }, (_, index) => index);

export interface TableSkeletonProps {
  /** Data columns, i.e. everything except the select column. */
  columns?: number;
  rows?: number;
  /** Whether the table has the shared checkbox column. Audit Log does not. */
  select?: boolean;
  className?: string;
}

/**
 * The loading form of the shared list table.
 *
 * It is built from the REAL table primitives — `TableContainer`, `TableHeader`,
 * `TableHead`, `TableSelectHead`, `TableBody`, `TableRow` — rather than from
 * plain divs, and that is the whole point: the header row gets
 * `.surface-toolbar`'s fill and its bottom rule for free, the select column is
 * `w-10`, and the cell padding is `px-2 py-1.5`. A hand-rolled grid of grey
 * rectangles would look approximately right and be wrong in every measurement,
 * and it would drift the first time the table primitives changed.
 *
 * The column counts are the caller's, because the count is the caller's fact:
 * Orders has eight data columns, Customers five, Audit Log five and no select
 * column at all. Pass the number the real table has.
 *
 * A row is deliberately NOT the full height of a data row on its own — the bars
 * are `h-5`, one line of the table's text. Measured against the live stack at
 * 1440px: a real cell is `px-2 py-1.5` around a 14px/20px line, so a row is 33px
 * and the placeholder is 32px. The 1px is the inline checkbox sitting on the
 * baseline, which a block placeholder does not reproduce and should not pretend
 * to. Audit Log's rows measure 53px because its Details column wraps to two
 * lines — that is a fact about its content, not about the table, and a
 * placeholder must not encode a guess about data that has not arrived.
 */
export function TableSkeleton({ columns = 5, rows = 8, select = true, className }: TableSkeletonProps) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading table" className={className}>
      {/* The list pages nest the table inside a card and cancel the container's
          own frame (`rounded-none border-0 bg-transparent`), so the skeleton
          cancels it the same way. */}
      <TableContainer className="rounded-none border-0 bg-transparent">
        <Table>
          <TableHeader>
            {/* `TableRow` paints a hover fill, which a placeholder must not do —
                nothing here is a target. `cn` merges the two `hover:bg-*` keys,
                so the last one wins. */}
            <TableRow className="hover:bg-transparent">
              {/* Each bar is the height of THAT cell's own line, which is not the
                  same number for the two head types: `TableHead` sets `text-xs`
                  (16px line), while `TableSelectHead` sets no size and inherits
                  the table's — `text-sm` at xl, a 20px line. Matching each cell
                  is what makes the header row the same height with and without
                  the checkbox column, which is exactly how the real one behaves
                  (measured 32.5px with it, 28.5px without). */}
              {select && (
                <TableSelectHead>
                  <Skeleton className="h-5 w-3.5" />
                </TableSelectHead>
              )}
              {range(columns).map((column) => (
                <TableHead key={column}>
                  <Skeleton className="h-4 w-16" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {range(rows).map((row) => (
              <TableRow key={row} className="hover:bg-transparent">
                {select && (
                  <TableSelectCell>
                    {/* 14px at 4px radius — the drawn `.app-checkbox` box, so the
                        column reads as the same control it will become. */}
                    <Skeleton className="h-3.5 w-3.5 rounded-[4px]" />
                  </TableSelectCell>
                )}
                {range(columns).map((column) => (
                  <TableCell key={column}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}
