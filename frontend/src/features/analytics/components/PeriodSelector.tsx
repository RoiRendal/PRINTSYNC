import { cn } from '../../../shared/lib/cn';
import { periodLabel, periods, type Period } from './analytics-types';

interface PeriodSelectorProps {
  value: Period;
  onChange: (period: Period) => void;
  prefix: string;
}

export function PeriodSelector({ value, onChange, prefix }: PeriodSelectorProps) {
  return (
    <div className="flex rounded-full border bg-[var(--app-surface-raised)] p-1 dark:bg-[#3d3d3f]">
      {periods.map((item) => (
        <button
          key={`${prefix}-${item}`}
          type="button"
          onClick={() => onChange(item)}
          className={cn('h-8 cursor-pointer rounded-full px-3 text-[10px] font-bold uppercase tracking-[0.16em]', value === item ? 'bg-macos-blue text-white' : 'text-macos-text-muted hover:bg-[var(--app-state-hover)] dark:text-zinc-400 dark:hover:bg-[#414143]')}
        >
          {periodLabel[item]}
        </button>
      ))}
    </div>
  );
}
