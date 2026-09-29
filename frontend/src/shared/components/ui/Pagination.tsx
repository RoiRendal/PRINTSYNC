import { ChevronLeft, ChevronRight } from './icons';
import { cn } from '../../lib/cn';

interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ page, limit, total, onPageChange, className }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;

  const getVisiblePages = (): (number | string)[] => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | string)[] = [1];
    if (page > 3) pages.push('...');
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  if (total <= limit) return null;

  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <span className="text-app-text-muted dark:text-zinc-500">
        Page {page} of {totalPages} ({total} total)
      </span>
      {/*
        Paging is drawn as the same grey control fill the buttons use, with no
        border, and the current page is one step darker rather than accent-dark.

        ERPNext's pager does exactly this: every page is a `--control-bg` chip
        with `border: 0px none`, and the current one is a lighter step (white
        against `#f8f8f8`) rather than the darkest value on the page. The
        bordered squares this replaces were the only outlined buttons left in the
        app, and an outlined square beside a filled one reads as a different kind
        of control for no reason.
      */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!canGoPrevious}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-[var(--radius-button)] bg-[var(--app-surface-sub)] text-app-ink dark:text-zinc-200',
            !canGoPrevious && 'cursor-not-allowed opacity-40',
            canGoPrevious && 'hover:bg-[var(--app-state-hover-sub)]',
          )}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        {getVisiblePages().map((p, index) => (
          p === '...' ? (
            <span key={`ellipsis-${index}`} className="px-1 text-app-text-muted dark:text-zinc-500">...</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p as number)}
              aria-current={page === p ? 'page' : undefined}
              className={cn(
                'flex h-7 min-w-[2rem] items-center justify-center rounded-[var(--radius-button)] px-1.5',
                page === p
                  ? 'bg-[var(--app-state-hover-sub)] font-semibold text-app-ink dark:text-zinc-100'
                  : 'bg-[var(--app-surface-sub)] text-app-ink hover:bg-[var(--app-state-hover-sub)] dark:text-zinc-200',
              )}
            >
              {p}
            </button>
          )
        ))}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!canGoNext}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-[var(--radius-button)] bg-[var(--app-surface-sub)] text-app-ink dark:text-zinc-200',
            !canGoNext && 'cursor-not-allowed opacity-40',
            canGoNext && 'hover:bg-[var(--app-state-hover-sub)]',
          )}
          aria-label="Next page"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
