import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../ui';
import { cn } from '../../lib/cn';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Unable to load data',
  message = 'Something went wrong. Please try again.',
  onRetry,
  className = '',
}: ErrorStateProps) {
  return (
    <div className={cn('flex min-h-24 flex-col items-center justify-center gap-3 text-center', className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] border border-[var(--app-border-hairline)] bg-[var(--app-tint-red)] text-macos-red dark:text-red-300">
        <AlertCircle className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-macos-text dark:text-zinc-100">{title}</p>
        <p className="max-w-sm text-xs leading-relaxed text-macos-text-muted dark:text-zinc-400">{message}</p>
      </div>
      {onRetry && (
        <Button type="button" variant="secondary" size="sm" onClick={onRetry} leftIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}>
          Retry
        </Button>
      )}
    </div>
  );
}
