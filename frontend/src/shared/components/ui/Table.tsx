import { forwardRef } from 'react';
import type { HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export interface TableContainerProps extends HTMLAttributes<HTMLDivElement> {
  glassHeader?: boolean;
}

/*
 * Phase 4: the table is deliberately NOT skeuomorphised.
 *
 * Every other primitive in this phase gains a bevel and a cast shadow. This one
 * does not, on purpose: dense tabular data is the one place where physical depth
 * costs legibility, and the instruction was explicit — tables stay flat.
 *
 * What it does get is the token sweep that Phase 3 left unfinished here. The
 * container was still carrying `border-gray-200/80` and `dark:bg-zinc-900`,
 * which meant a dark-mode table rendered *darker* than the raised cards around
 * it. It now takes the same surface as everything else, so the `dark:` override
 * is gone and the table reads as a card that happens to contain rows.
 *
 * `TableHeader` already sits on `.surface-toolbar` from Phase 3 — a flat chrome
 * strip with a hairline bottom edge, which is the right treatment for a header
 * row and needs no further change.
 */
export const TableContainer = forwardRef<HTMLDivElement, TableContainerProps>(({ className, glassHeader: _glassHeader, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'overflow-hidden rounded-[var(--radius-card)] border border-[var(--app-hairline)] bg-[var(--app-surface-raised)] shadow-[var(--shadow-card)]',
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
  <thead ref={ref} className={cn('surface-toolbar text-macos-text-muted', className)} {...props} />
));

TableHeader.displayName = 'TableHeader';

export const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn('divide-y divide-gray-100 dark:divide-white/10', className)} {...props} />
));

TableBody.displayName = 'TableBody';

export const TableFooter = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => (
  <tfoot ref={ref} className={cn('border-t border-gray-100 bg-gray-50/70 dark:border-white/10 dark:bg-white/5', className)} {...props} />
));

TableFooter.displayName = 'TableFooter';

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(({ className, ...props }, ref) => (
  <tr ref={ref} className={cn('transition-colors duration-150 hover:bg-macos-blue/5 dark:hover:bg-macos-blue-dark/10', className)} {...props} />
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
