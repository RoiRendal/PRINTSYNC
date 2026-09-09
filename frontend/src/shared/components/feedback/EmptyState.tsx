import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

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
  icon = <Inbox className="h-8 w-8 opacity-20" aria-hidden="true" />,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 text-gray-400 ${className}`}>
      {icon}
      <p className="text-[10px] font-bold uppercase tracking-widest">{title}</p>
      {message && <p className="text-xs text-gray-500 dark:text-zinc-500">{message}</p>}
      {action}
    </div>
  );
}
