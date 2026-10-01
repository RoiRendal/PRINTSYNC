import { AlertCircle } from '../ui/icons';
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
        The glyph is bare and carries no hue. It used to sit in a 56px red-tinted
        rounded square; the alert-circle shape plus the sentence under it already
        say what happened, so a second, colour-only cue was redundant. Muted,
        like the copy beside it.
      */}
      <span className="text-app-text-muted dark:text-zinc-400">
        <AlertCircle className="h-6 w-6" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-xs font-bold text-app-ink dark:text-zinc-100">{title}</p>
        <p className="max-w-sm text-xs leading-relaxed text-app-text-muted dark:text-zinc-400">{message}</p>
      </div>
      {onRetry && (
        <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
