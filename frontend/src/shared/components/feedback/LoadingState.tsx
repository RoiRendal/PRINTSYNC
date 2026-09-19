import { motion } from 'motion/react';
import { LoaderCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

interface LoadingStateProps {
  label?: string;
  className?: string;
}

export function LoadingState({ label = 'Loading', className = '' }: LoadingStateProps) {
  return (
    <div className={cn('flex min-h-24 flex-col items-center justify-center gap-3 text-macos-text-muted dark:text-zinc-500', className)}>
      <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/55 bg-white/60 shadow-[var(--shadow-card)] dark:border-white/10 dark:bg-white/8">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.1, ease: 'linear', repeat: Infinity }}
          className="text-macos-blue dark:text-macos-cyan"
        >
          <LoaderCircle className="h-5 w-5" aria-hidden="true" />
        </motion.div>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-[0.24em]">{label}</span>
    </div>
  );
}
