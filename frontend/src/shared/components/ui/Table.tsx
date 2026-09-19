import { forwardRef } from 'react';
import type { HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export interface TableContainerProps extends HTMLAttributes<HTMLDivElement> {
  raisedHeader?: boolean;
}

export const TableContainer = forwardRef<HTMLDivElement, TableContainerProps>(({ className, raisedHeader: _raisedHeader, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'overflow-hidden rounded-[var(--radius-card)] border border-[var(--app-border-hairline)] bg-[var(--app-surface-raised)] shadow-[var(--shadow-card)]',
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
  <tr ref={ref} className={cn('transition-colors duration-150 hover:bg-[var(--app-state-hover)]', className)} {...props} />
));

TableRow.displayName = 'TableRow';

export const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
  <th ref={ref} className={cn('px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.2em]', className)} {...props} />
));

TableHead.displayName = 'TableHead';

export const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn('px-4 py-2.5 align-middle text-gray-700 dark:text-zinc-300', className)} {...props} />
));

TableCell.displayName = 'TableCell';

export const TableCaption = forwardRef<HTMLTableCaptionElement, HTMLAttributes<HTMLTableCaptionElement>>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn('mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-macos-text-muted', className)} {...props} />
));

TableCaption.displayName = 'TableCaption';
