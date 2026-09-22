import type { LucideIcon } from 'lucide-react';
import { SurfaceCard } from '../../../shared/components/ui';
import { cn } from '../../../shared/lib/cn';

interface MetricTileProps {
  label: string;
  value: string;
  tone?: 'neutral' | 'blue' | 'green' | 'red' | 'orange' | 'purple';
  icon?: LucideIcon;
}

export function MetricTile({ label, value, tone = 'neutral', icon: Icon }: MetricTileProps) {
  return (
    <SurfaceCard className="p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-macos-text-muted dark:text-zinc-500">{label}</p>
          <p className={cn('mt-1 font-mono text-sm font-bold text-macos-text dark:text-zinc-100', tone === 'blue' && 'text-macos-blue dark:text-macos-cyan', tone === 'green' && 'text-green-700 dark:text-green-300', tone === 'red' && 'text-red-700 dark:text-red-300', tone === 'orange' && 'text-orange-700 dark:text-orange-300', tone === 'purple' && 'text-purple-700 dark:text-purple-300')}>{value}</p>
        </div>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-macos-text-muted dark:text-zinc-500" aria-hidden="true" />}
      </div>
    </SurfaceCard>
  );
}
