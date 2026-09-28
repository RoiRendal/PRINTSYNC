import { SurfaceCard } from '../../../shared/components/ui';
import { cn } from '../../../shared/lib/cn';

/**
 * A number card: label + value, and nothing else.
 *
 * ERPNext's Number Card carries no decorative icon — the figure is the whole
 * card. An icon here was pure ornament: it sat muted in the top-right corner,
 * carried no meaning the label did not already state, and cost a Lucide import
 * per tile. Removed so the analytics cards match the ERPNext reference.
 */
interface MetricTileProps {
  label: string;
  value: string;
  tone?: 'neutral' | 'accent' | 'green' | 'red' | 'orange' | 'purple';
}

export function MetricTile({ label, value, tone = 'neutral' }: MetricTileProps) {
  return (
    <SurfaceCard className="p-3">
      <p className="truncate text-2xs font-bold text-app-text-muted dark:text-zinc-500">{label}</p>
      <p className={cn('mt-1 tabular-nums text-sm font-bold text-app-ink dark:text-zinc-100', tone === 'accent' && 'text-app-accent dark:text-app-accent-soft', tone === 'green' && 'text-green-700 dark:text-green-300', tone === 'red' && 'text-red-700 dark:text-red-300', tone === 'orange' && 'text-orange-700 dark:text-orange-300', tone === 'purple' && 'text-purple-700 dark:text-purple-300')}>{value}</p>
    </SurfaceCard>
  );
}
