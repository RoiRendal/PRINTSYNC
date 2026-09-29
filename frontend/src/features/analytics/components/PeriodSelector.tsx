import { SegmentedControl } from '../../../shared/components/ui';
import { periodLabel, periods, type Period } from './analytics-types';

interface PeriodSelectorProps {
  value: Period;
  onChange: (period: Period) => void;
  /** Distinguishes the several period selectors that can share one screen. */
  prefix: string;
}

export function PeriodSelector({ value, onChange, prefix }: PeriodSelectorProps) {
  return (
    <SegmentedControl
      aria-label={`${prefix} period`}
      value={value}
      onChange={onChange}
      options={periods.map((item) => ({ value: item, label: periodLabel[item] }))}
    />
  );
}
