import { forwardRef } from 'react';
import type { HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

/**
 * `raisedHeader` used to live here — a boolean that was accepted and then
 * discarded (`raisedHeader: _raisedHeader`, never read). Nothing passed it, and
 * nothing could: the raised header it was meant to switch on no longer exists as
 * a separate surface. A prop that silently does nothing is worse than no prop,
 * because passing it looks like it worked.
 */
export type TableContainerProps = HTMLAttributes<HTMLDivElement>;

export const TableContainer = forwardRef<HTMLDivElement, TableContainerProps>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'overflow-hidden rounded-[var(--radius-card)] border border-[var(--app-border-hairline)]',
      className,
    )}
    {...props}
  />
));

TableContainer.displayName = 'TableContainer';

/**
 * `table-fixed` is what makes one-line rows possible at all.
 *
 * With the default auto layout a cell is sized by its content, so `overflow` and
 * `text-overflow` on it are advisory — the column simply grows and the text
 * wraps onto a second line instead of being cut. Fixed layout takes the width
 * from the first row (or the `colgroup`) and holds it, which is the precondition
 * for an ellipsis to engage. ERPNext does the same thing from the other
 * direction: it pins `--list-row-height` to 30px, so a cell that wrapped would
 * break the grid.
 *
 * Consequence to keep in mind: a table with no `colgroup` now divides its width
 * EQUALLY between columns, which is almost never what the content wants. Every
 * list table declares its widths.
 */
export const Table = forwardRef<HTMLTableElement, TableHTMLAttributes<HTMLTableElement>>(({ className, ...props }, ref) => (
  <div className="overflow-x-auto">
    <table ref={ref} className={cn('w-full table-fixed border-collapse text-left text-xs xl:text-sm', className)} {...props} />
  </div>
));

Table.displayName = 'Table';

export const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('surface-toolbar text-app-text-muted dark:text-zinc-400', className)} {...props} />
));

TableHeader.displayName = 'TableHeader';

export const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn('divide-y', className)} {...props} />
));

TableBody.displayName = 'TableBody';

export const TableFooter = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => (
  <tfoot ref={ref} className={cn('border-t border-[var(--app-border-hairline)] bg-[var(--app-surface-sub)]', className)} {...props} />
));

TableFooter.displayName = 'TableFooter';

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(({ className, ...props }, ref) => (
  <tr ref={ref} className={cn(' hover:bg-[var(--app-state-hover)]', className)} {...props} />
));

TableRow.displayName = 'TableRow';

/**
 * One line, like every cell below it.
 *
 * A header that wrapped would make the head row two lines tall on its own, which
 * is the raggedness this pass exists to remove. If a header is too narrow the
 * fix is its column's width, not letting it wrap — the ellipsis makes that
 * visible instead of hiding it behind a taller row.
 */
export const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
  <th ref={ref} className={cn('truncate px-2 py-1.5 text-xs font-semibold', className)} {...props} />
));

TableHead.displayName = 'TableHead';

/**
 * `truncate` here is the rule: a data cell is one line, always.
 *
 * Clipping without a way to read the whole value is just deleting it, so the
 * full string belongs on the cell (see the tooltip pass). A cell that legitimately
 * holds a BLOCK — the empty-state row, which spans every column and centres a
 * message — opts back out with `whitespace-normal`; `cn` merges the two keys and
 * the caller's wins.
 *
 * A flex child inside a cell needs `min-w-0` of its own, or it refuses to shrink
 * and gets cut without an ellipsis.
 */
export const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn('truncate px-2 py-1.5 align-middle text-gray-700 dark:text-zinc-300', className)} {...props} />
));

TableCell.displayName = 'TableCell';

/**
 * The tooltip for a clipped cell: the column's own label, then the FULL value.
 * This is the string ERPNext's list view writes onto every cell
 * (`title="Status: Open"`), and it is why a clipped value there is never lost.
 *
 * Native `title` is a deliberate choice, not a shortcut. It is the one tooltip
 * that renders identically in both themes — a dark box with light text, drawn by
 * the browser — which is the behaviour this app is being matched to. It needs no
 * positioning, no portal, no state and no measurement. The trade is real and
 * accepted: roughly a second of hover delay, no styling, and no way to wrap a
 * very long value onto a second line.
 *
 * Returns `undefined` for an empty value, so a cell showing the em-dash
 * placeholder gets no tooltip at all — "Notes: " on an empty cell explains
 * nothing and just adds noise.
 *
 * Pass the value the cell actually renders, formatted the way the cell renders
 * it, so the tooltip completes the visible text rather than restating something
 * different.
 */
export function cellTitle(label: string, value: string | number | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  if (text === '') return undefined;
  return `${label}: ${text}`;
}

export const TableCaption = forwardRef<HTMLTableCaptionElement, HTMLAttributes<HTMLTableCaptionElement>>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn('mt-3 text-2xs font-semibold text-app-text-muted', className)} {...props} />
));

TableCaption.displayName = 'TableCaption';

/**
 * The leftmost column every list table shares: one box in the header that ticks
 * the whole page, one per row.
 *
 * The column is defined here rather than written out in each table for the same
 * reason the rest of this file exists — four hand-rolled copies drift, and a
 * column that is 40px wide in one table and 56px in another reads as a mistake.
 * It is deliberately narrower than a data cell (`w-10`) so it
 * reads as table chrome rather than as a field, and the header carries no label:
 * the box is its own label.
 *
 * Pair it with `useRowSelection` for the state and `Checkbox` for the control.
 */
export const TableSelectHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
  <th ref={ref} scope="col" className={cn('w-10 px-2 py-1.5', className)} {...props} />
));

TableSelectHead.displayName = 'TableSelectHead';

export const TableSelectCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn('w-10 px-2 py-1.5 align-middle', className)} {...props} />
));

TableSelectCell.displayName = 'TableSelectCell';
