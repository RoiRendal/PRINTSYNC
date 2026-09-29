import { AlertCircle, RefreshCw } from '../ui/icons';
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
        The glyph is bare. It used to sit in a 56px rounded square with a
        hairline border and a red tint — a box around an icon that already had
        the red message under it. The colour is information and stays; the frame
        was not.
      */}
      <span className="text-app-danger dark:text-red-300">
        <AlertCircle className="h-6 w-6" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-xs font-bold text-app-ink dark:text-zinc-100">{title}</p>
        <p className="max-w-sm text-xs leading-relaxed text-app-text-muted dark:text-zinc-400">{message}</p>
      </div>
      {onRetry && (
        <Button type="button" variant="secondary" size="sm" onClick={onRetry} leftIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}>
          Retry
        </Button>
      )}
    </div>
  );
}
