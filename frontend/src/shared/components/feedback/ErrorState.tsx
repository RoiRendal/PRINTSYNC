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
        No glyph. It was already bare and hue-free, but a bare glyph is still a
        glyph: the title and the sentence under it say what happened, so the
        shape only repeated them. Same rule as the card figure — a surface
        carries its words, not a picture of its words.
      */}
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
