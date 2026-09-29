import { LoaderCircle } from '../ui/icons';
import { cn } from '../../lib/cn';

interface LoadingStateProps {
  label?: string;
  className?: string;
}

export function LoadingState({ label = 'Loading', className = '' }: LoadingStateProps) {
  return (
    <div className={cn('flex min-h-24 flex-col items-center justify-center gap-3 text-app-text-muted dark:text-zinc-500', className)}>
      {/*
        The spinner is bare. It used to sit in a 48px rounded square with a
        hairline border, which drew a second, static box around a control that is
        already moving — the motion is what says "loading", not the frame.
      */}
      <span className="text-app-accent dark:text-app-accent-soft">
        <LoaderCircle className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="text-2xs font-bold">{label}</span>
    </div>
  );
}
