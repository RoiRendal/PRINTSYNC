import { ChevronLeft, ChevronRight } from 'lucide-react';
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
      <span className="text-[10px] font-medium uppercase tracking-wider text-macos-text-muted dark:text-zinc-500">
        Page {page} of {totalPages} ({total} total)
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!canGoPrevious}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-lg border border-white/50 bg-white/60 text-macos-text shadow-[var(--shadow-card)] transition-all dark:border-white/10 dark:bg-white/8 dark:text-zinc-200',
            !canGoPrevious && 'cursor-not-allowed opacity-40',
            canGoPrevious && 'hover:border-macos-blue/30 hover:bg-white/80 dark:hover:border-macos-blue-dark/25',
          )}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        {getVisiblePages().map((p, index) => (
          p === '...' ? (
            <span key={`ellipsis-${index}`} className="px-1 text-[10px] text-macos-text-muted dark:text-zinc-500">...</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p as number)}
              className={cn(
                'flex h-7 min-w-[1.75rem] items-center justify-center rounded-lg border px-1.5 text-[10px] font-bold uppercase tracking-wider shadow-[var(--shadow-card)] transition-all',
                page === p
                  ? 'border-macos-blue/30 bg-macos-blue text-white dark:border-macos-blue-dark/25 dark:bg-macos-blue-dark'
                  : 'border-white/50 bg-white/60 text-macos-text hover:border-macos-blue/30 hover:bg-white/80 dark:border-white/10 dark:bg-white/8 dark:text-zinc-200 dark:hover:border-macos-blue-dark/25',
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
            'flex h-7 w-7 items-center justify-center rounded-lg border border-white/50 bg-white/60 text-macos-text shadow-[var(--shadow-card)] transition-all dark:border-white/10 dark:bg-white/8 dark:text-zinc-200',
            !canGoNext && 'cursor-not-allowed opacity-40',
            canGoNext && 'hover:border-macos-blue/30 hover:bg-white/80 dark:hover:border-macos-blue-dark/25',
          )}
          aria-label="Next page"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
