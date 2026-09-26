import { Inbox } from 'lucide-react';
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
    <div className={cn('flex flex-col items-center justify-center gap-3 text-center text-macos-text-muted dark:text-zinc-500', className)}>
      <div className="flex h-16 w-16 items-center justify-center rounded-[1.35rem] border border-[var(--app-border-hairline)] text-macos-blue dark:text-macos-cyan">
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-xs font-bold text-macos-text dark:text-zinc-100">{title}</p>
        {message && <p className="max-w-sm text-xs leading-relaxed text-macos-text-muted dark:text-zinc-400">{message}</p>}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
