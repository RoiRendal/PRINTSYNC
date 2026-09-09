import { LoaderCircle } from 'lucide-react';

interface LoadingStateProps {
  label?: string;
  className?: string;
}

export function LoadingState({ label = 'Loading', className = '' }: LoadingStateProps) {
  return (
    <div className={`flex min-h-24 flex-col items-center justify-center gap-2 text-gray-400 dark:text-zinc-500 ${className}`}>
      <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
    </div>
  );
}
