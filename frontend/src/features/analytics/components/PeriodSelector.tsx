import { cn } from '../../../shared/lib/cn';
import { periodLabel, periods, type Period } from './analytics-types';

interface PeriodSelectorProps {
  value: Period;
  onChange: (period: Period) => void;
  prefix: string;
}

export function PeriodSelector({ value, onChange, prefix }: PeriodSelectorProps) {
  return (
    <div className="surface-segmented flex rounded-full p-1">
      {periods.map((item) => (
        <button
          key={`${prefix}-${item}`}
          type="button"
          onClick={() => onChange(item)}
          className={cn('mat-focus h-8 cursor-pointer rounded-full px-3 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors', value === item ? 'mat-sunk bg-macos-blue text-white' : 'ambient amb-elevation-0 mat-press text-macos-text-muted hover:text-macos-text dark:hover:text-zinc-100')}
          aria-pressed={value === item}
        >
          {periodLabel[item]}
        </button>
      ))}
    </div>
  );
}
