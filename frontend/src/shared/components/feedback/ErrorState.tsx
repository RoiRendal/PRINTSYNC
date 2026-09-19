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
      {/*
        Same recessed-well recipe as every other icon chip in the app, and the
        same red as the rest of the app's red tone. This is the inline twin of
        the full-screen error boundary's medallion — the two were a matching
        pair, so they are changed together or not at all.

        The previous colour here was the Apple system red, #ff3b30. On the white
        card behind it that measures 3.55:1, under the 4.5:1 floor for text this
        size. The current value is the red the dashboard and the order summary
        already use, and it measures 6.42:1 on the same card.

        (The old utility is described rather than named on purpose: Tailwind
        scans comments as class candidates, so naming it here would re-emit it
        into the built stylesheet.)
      */}
      <div className="amb-groove mat-well flex h-14 w-14 items-center justify-center rounded-[1.25rem] border border-[var(--app-hairline)] text-red-700 dark:text-red-300">
        <AlertCircle className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-macos-text dark:text-zinc-100">{title}</p>
        <p className="max-w-sm text-xs leading-relaxed text-macos-text-muted">{message}</p>
      </div>
      {onRetry && (
        <Button type="button" variant="secondary" size="sm" onClick={onRetry} leftIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}>
          Retry
        </Button>
      )}
    </div>
  );
}
