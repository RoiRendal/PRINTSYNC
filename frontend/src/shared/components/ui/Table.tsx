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

export const Table = forwardRef<HTMLTableElement, TableHTMLAttributes<HTMLTableElement>>(({ className, ...props }, ref) => (
  <div className="overflow-x-auto">
    <table ref={ref} className={cn('w-full border-collapse text-left text-xs xl:text-sm', className)} {...props} />
  </div>
));

Table.displayName = 'Table';

export const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('surface-toolbar text-macos-text-muted dark:text-zinc-400', className)} {...props} />
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

export const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
  <th ref={ref} className={cn('px-4 py-2.5 text-[11px] font-semibold', className)} {...props} />
));

TableHead.displayName = 'TableHead';

export const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn('px-4 py-2.5 align-middle text-gray-700 dark:text-zinc-300', className)} {...props} />
));

TableCell.displayName = 'TableCell';

export const TableCaption = forwardRef<HTMLTableCaptionElement, HTMLAttributes<HTMLTableCaptionElement>>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn('mt-3 text-[10px] font-semibold text-macos-text-muted', className)} {...props} />
));

TableCaption.displayName = 'TableCaption';

/**
 * The leftmost column every list table shares: one box in the header that ticks
 * the whole page, one per row.
 *
 * The column is defined here rather than written out in each table for the same
 * reason the rest of this file exists — four hand-rolled copies drift, and a
 * column that is 40px wide in one table and 56px in another reads as a mistake.
 * It is deliberately narrower than a data cell (`w-10`, tighter padding) so it
 * reads as table chrome rather than as a field, and the header carries no label:
 * the box is its own label.
 *
 * Pair it with `useRowSelection` for the state and `Checkbox` for the control.
 */
export const TableSelectHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
  <th ref={ref} scope="col" className={cn('w-10 px-3 py-2.5', className)} {...props} />
));

TableSelectHead.displayName = 'TableSelectHead';

export const TableSelectCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn('w-10 px-3 py-2.5 align-middle', className)} {...props} />
));

TableSelectCell.displayName = 'TableSelectCell';
