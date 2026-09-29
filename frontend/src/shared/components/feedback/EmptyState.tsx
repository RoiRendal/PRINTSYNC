import { Inbox } from '../ui/icons';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  message,
  icon = <Inbox className="h-7 w-7" aria-hidden="true" />,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 text-center text-app-text-muted dark:text-zinc-500', className)}>
      {/*
        No 64px ringed tile around the glyph, and no hue on the glyph itself —
        the shape says "nothing here yet" and the sentence under it says what
        that means. Colour would only restate it. Muted, like the copy beside it.
      */}
      <span className="text-app-text-muted dark:text-zinc-400">{icon}</span>
      <div className="space-y-1">
        <p className="text-xs font-bold text-app-ink dark:text-zinc-100">{title}</p>
        {message && <p className="max-w-sm text-xs leading-relaxed text-app-text-muted dark:text-zinc-400">{message}</p>}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
