import { AlertCircle, RefreshCw } from 'lucide-react';

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
    <div className={`flex min-h-24 flex-col items-center justify-center gap-2 text-red-500 dark:text-red-400 ${className}`}>
      <AlertCircle className="h-5 w-5" aria-hidden="true" />
      <p className="text-[10px] font-bold uppercase tracking-widest">{title}</p>
      <p className="text-xs text-gray-500 dark:text-zinc-400">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 inline-flex items-center gap-1.5 rounded border border-gray-200 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-700 hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          Retry
        </button>
      )}
    </div>
  );
}
