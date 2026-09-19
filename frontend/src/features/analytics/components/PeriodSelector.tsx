import { cn } from '../../../shared/lib/cn';
import { periodLabel, periods, type Period } from './analytics-types';

interface PeriodSelectorProps {
  value: Period;
  onChange: (period: Period) => void;
  prefix: string;
}

export function PeriodSelector({ value, onChange, prefix }: PeriodSelectorProps) {
  return (
    <div className="flex rounded-full border border-white/50 bg-white/55 p-1 shadow-[var(--shadow-card)] dark:border-white/10 dark:bg-white/8">
      {periods.map((item) => (
        <button
          key={`${prefix}-${item}`}
          type="button"
          onClick={() => onChange(item)}
          className={cn('h-8 cursor-pointer rounded-full px-3 text-[10px] font-bold uppercase tracking-[0.16em] transition-all', value === item ? 'bg-macos-blue text-white shadow-[0_6px_16px_rgb(0_122_255/0.22)]' : 'text-macos-text-muted hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10')}
        >
          {periodLabel[item]}
        </button>
      ))}
    </div>
  );
}
