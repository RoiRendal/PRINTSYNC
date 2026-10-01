import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { TileRowSkeleton } from '../../../shared/components/feedback/TileRowSkeleton';
import { InlineAlert } from '../../../shared/components/feedback/InlineAlert';
import { StatTile, StatTileRow } from '../../../shared/components/ui';
import { useOrdersSummary } from '../../orders/hooks/useOrdersSummary';
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

/**
 * The Workspace tile is now the app's one `StatTile`, and two things about the
 * old one are worth recording because neither is obvious from the result.
 *
 * **The unit word moved into the label.** "Pending" plus a small "orders"
 * beside the figure was the only tile in the app with three lines of content,
 * so it stood taller than the Orders, Inventory and Customers rows — which is
 * exactly the inconsistency this round exists to remove. The label is a noun
 * phrase now ("Pending orders"), which is what `StatTile` documents it as.
 *
 * **The hint sentence is gone.** "New jobs not yet started." was orientation
 * text, and dropping it costs that — but it was also the reason the Dashboard
 * row was three lines while every other page is two, and the same information
 * is one click away in the list the tile opens.
 *
 * **The red low-stock figure is gone too.** ERPNext never colours a number,
 * and a red "5" said with colour what the label already says with words. Low
 * stock above zero is still visible: the tile names it, and it links straight
 * to the filtered inventory view that labels it.
 *
 * **The header is gone as well.** `DashboardHeader` printed an `h1` reading
 * "Dashboard" and a subtitle sentence inside the page, immediately under a
 * toolbar that already named the page. Both were removed in the same pass as
 * every other page's header (the toolbar carries the name now), which also
 * takes the sentence — the last piece of orientation text on this screen. The
 * counts are one click from the lists they count, so the tiles speak for
 * themselves.
 */

/** Reads one status's count from the zero-filled `byStatus` array. */
function countFor(summary: OrdersSummary, status: OrderStatus): number {
  return summary.byStatus.find((entry) => entry.status === status)?.count ?? 0;
}

export default function Dashboard() {
  const { summary, error, isLoading, refresh } = useOrdersSummary();

  // First load: nothing to show yet. The Workspace is one row of five figures,
  // so the placeholder is one row of five figures — no `min-h-64` either, which
  // would reserve 256px for a row that is 84px tall.
  if (isLoading && !summary) {
    return <TileRowSkeleton columns={5} />;
  }

  // No data at all — say so plainly. Deliberately no zeros: a screen of zeros
  // looks like a quiet morning, not a failed request.
  if (!summary) {
    return (
      <div className="space-y-5">
        <ErrorState
          title="Workspace unavailable"
          message={error ?? 'The workspace counts could not be loaded.'}
          onRetry={refresh}
          className="min-h-64"
        />
      </div>
    );
  }

  const cards: Array<{ label: string; count: number; to: string }> = [
    {
      label: 'Pending orders',
      count: countFor(summary, 'Pending'),
      to: '/orders?status=Pending',
    },
    {
      label: 'Designing orders',
      count: countFor(summary, 'Designing'),
      to: '/orders?status=Designing',
    },
    {
      label: 'In Production orders',
      count: countFor(summary, 'In Production'),
      to: `/orders?status=${encodeURIComponent('In Production')}`,
    },
    {
      label: 'Ready for Pickup orders',
      count: countFor(summary, 'Ready for Pickup'),
      to: `/orders?status=${encodeURIComponent('Ready for Pickup')}`,
    },
    {
      label: 'Low stock items',
      count: summary.lowStock,
      to: '/inventory?lowStock=1',
    },
  ];

  const workWaiting = cards.reduce((total, card) => total + card.count, 0);

  return (
    <div className="space-y-5">
      {/* A background reload failed but the last good counts are still on screen —
          keep them, and say they may be behind. */}
      {error && <InlineAlert message={`${error} Showing the last known counts.`} />}

      <StatTileRow columns={5}>
        {cards.map((card) => (
          <StatTile key={card.label} label={card.label} value={card.count} to={card.to} />
        ))}
      </StatTileRow>

      {workWaiting === 0 && (
        <p className="text-xs text-app-text-muted dark:text-zinc-400">
          Nothing is waiting right now — every queue is clear.
        </p>
      )}
    </div>
  );
}
