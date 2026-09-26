import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, ArrowRight, Clock, Hammer, PackageCheck, PenTool } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { InlineAlert } from '../../../shared/components/feedback/InlineAlert';
import { SurfaceCard } from '../../../shared/components/ui';
import { cn } from '../../../shared/lib/cn';
import { useOrdersSummary } from '../hooks/useOrdersSummary';
import type { OrderStatus, OrdersSummary } from '../../orders/types';

/**
 * The Workspace: how much work is waiting, and where to act on it.
 *
 * Each tile *is* the filter — clicking "Ready for Pickup" opens `/orders` already
 * narrowed to those orders, because Phases 4/4b/6 made the lists honour a query
 * parameter server-side. That is the whole point of this page: one click from
 * "what needs attention" to the list that answers it.
 *
 * It shows work in flight only — Pending, Designing, In Production, Ready for
 * Pickup and Low stock. Revenue is deliberately absent: it is a money figure with a
 * date range and belongs on Analytics, not on a triage screen.
 *
 * Every count comes from `GET /orders/summary`, computed in the database over the
 * whole table. There is no client-side tally here, by design — a number derived
 * from page 1 of a 20-row list is the defect this page used to carry.
 */

interface WorkspaceTileProps {
  label: string;
  count: number;
  /** The unit word shown beside the count, e.g. "orders" or "items". */
  unit: string;
  to: string;
  icon: LucideIcon;
  detail: string;
  /** Draws attention (red) when the queue needs action, e.g. Low stock above zero. */
  alert?: boolean;
}

function WorkspaceTile({ label, count, unit, to, icon: Icon, detail, alert = false }: WorkspaceTileProps) {
  return (
    <Link
      to={to}
      className="block rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-macos-blue"
    >
      <SurfaceCard className="h-full p-4 hover:bg-[var(--app-state-hover)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="label-caps text-macos-text-muted dark:text-zinc-500">{label}</p>
            <p className="mt-2 flex items-baseline gap-1.5">
              <span
                className={cn(
                  'text-3xl font-bold tracking-tight text-macos-text dark:text-zinc-100',
                  alert && 'text-macos-red dark:text-red-300',
                )}
              >
                {count}
              </span>
              <span className="text-2xs font-bold text-macos-text-muted dark:text-zinc-500">{unit}</span>
            </p>
            <p className="mt-1 text-xs leading-relaxed text-macos-text-muted dark:text-zinc-400">{detail}</p>
          </div>
          <Icon
            className={cn(
              'h-5 w-5 shrink-0 text-macos-text-muted dark:text-zinc-500',
              alert && 'text-macos-red dark:text-red-300',
            )}
            aria-hidden="true"
          />
        </div>
        <div className="mt-4 flex items-center gap-1 text-2xs font-bold text-macos-blue dark:text-macos-cyan">
          <span>View list</span>
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </div>
      </SurfaceCard>
    </Link>
  );
}

function DashboardHeader() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-macos-text dark:text-zinc-100 lg:text-title">Dashboard</h1>
      <p className="mt-1 text-sm text-macos-text-muted dark:text-zinc-400">
        What needs your attention today — every count opens the list behind it.
      </p>
    </div>
  );
}

/** Reads one status's count from the zero-filled `byStatus` array. */
function countFor(summary: OrdersSummary, status: OrderStatus): number {
  return summary.byStatus.find((entry) => entry.status === status)?.count ?? 0;
}

export default function Dashboard() {
  const { summary, error, isLoading, refresh } = useOrdersSummary();

  // First load: nothing to show yet.
  if (isLoading && !summary) {
    return <LoadingState label="Loading workspace" className="min-h-64" />;
  }

  // No data at all — say so plainly. Deliberately no zeros: a screen of zeros
  // looks like a quiet morning, not a failed request.
  if (!summary) {
    return (
      <div className="space-y-5">
        <DashboardHeader />
        <ErrorState
          title="Workspace unavailable"
          message={error ?? 'The workspace counts could not be loaded.'}
          onRetry={refresh}
          className="min-h-64"
        />
      </div>
    );
  }

  const cards: WorkspaceTileProps[] = [
    {
      label: 'Pending',
      count: countFor(summary, 'Pending'),
      unit: 'orders',
      to: '/orders?status=Pending',
      icon: Clock,
      detail: 'New jobs not yet started.',
    },
    {
      label: 'Designing',
      count: countFor(summary, 'Designing'),
      unit: 'orders',
      to: '/orders?status=Designing',
      icon: PenTool,
      detail: 'Artwork in progress.',
    },
    {
      label: 'In Production',
      count: countFor(summary, 'In Production'),
      unit: 'orders',
      to: `/orders?status=${encodeURIComponent('In Production')}`,
      icon: Hammer,
      detail: 'On the press right now.',
    },
    {
      label: 'Ready for Pickup',
      count: countFor(summary, 'Ready for Pickup'),
      unit: 'orders',
      to: `/orders?status=${encodeURIComponent('Ready for Pickup')}`,
      icon: PackageCheck,
      detail: 'Printed and waiting for collection.',
    },
    {
      label: 'Low stock',
      count: summary.lowStock,
      unit: 'items',
      to: '/inventory?lowStock=1',
      icon: AlertTriangle,
      detail: 'Materials at or below reorder level.',
      alert: summary.lowStock > 0,
    },
  ];

  const workWaiting = cards.reduce((total, card) => total + card.count, 0);

  return (
    <div className="space-y-5">
      <DashboardHeader />

      {/* A background reload failed but the last good counts are still on screen —
          keep them, and say they may be behind. */}
      {error && <InlineAlert message={`${error} Showing the last known counts.`} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 xl:gap-4">
        {cards.map((card) => (
          <WorkspaceTile key={card.label} {...card} />
        ))}
      </div>

      {workWaiting === 0 && (
        <p className="text-xs text-macos-text-muted dark:text-zinc-400">
          Nothing is waiting right now — every queue is clear.
        </p>
      )}
    </div>
  );
}
