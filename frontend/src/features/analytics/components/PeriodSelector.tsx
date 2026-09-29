import { cn } from '../../../shared/lib/cn';
import { periodLabel, periods, type Period } from './analytics-types';

interface PeriodSelectorProps {
  value: Period;
  onChange: (period: Period) => void;
  prefix: string;
}

export function PeriodSelector({ value, onChange, prefix }: PeriodSelectorProps) {
  return (
    <div className="flex rounded-full border p-1">
      {periods.map((item) => (
        <button
          key={`${prefix}-${item}`}
          type="button"
          onClick={() => onChange(item)}
          className={cn('h-8 cursor-pointer rounded-full px-3 text-2xs font-bold', value === item ? 'bg-app-accent text-[var(--app-accent-ink)]' : 'text-app-text-muted hover:bg-[var(--app-state-hover)] dark:text-zinc-400 dark:hover:bg-[var(--app-tint-neutral)]')}
        >
          {periodLabel[item]}
        </button>
      ))}
    </div>
  );
}
