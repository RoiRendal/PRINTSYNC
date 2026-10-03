import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { TileRowSkeleton } from '../../../shared/components/feedback/TileRowSkeleton';
import { InlineAlert } from '../../../shared/components/feedback/InlineAlert';
import { StatTile, StatTileRow } from '../../../shared/components/ui';
import { useOrdersSummary } from '../../orders/hooks/useOrdersSummary';
import type { OrderStatus, OrdersSummary } from '../../orders/types';

/**
 * The Workspace: how much work is waiting, and where to act on it.
 *
 * Two rows, and the split is the point.
 *
 *   - **The queue row** is work in flight — Pending, Designing, In Production
 *     and Ready for Pickup. Each tile *is* the filter: clicking "Ready for
 *     Pickup" opens `/orders` already narrowed to those orders, because Phases
 *     4/4b/6 made the lists honour a query parameter server-side. One click from
 *     "what needs attention" to the list that answers it.
 *   - **The stock row** is Inventory's three figures — Total Stock, Stock Value
 *     and Low Stock — which used to sit above the Inventory page's table and now
 *     live here instead. That page opens on the list it exists to show; a band of
 *     reference totals above a table was the clutter this move removes.
 *
 * **Low stock appears once.** The queue row used to carry it as a fifth tile, and
 * moving Inventory's own "Low Stock" card up would have printed the same number
 * twice on one screen, so the tile moved down into the stock row rather than
 * being duplicated. It still links to `/inventory?lowStock=1`, the filtered list
 * that labels it.
 *
 * Revenue is still deliberately absent: it is a money figure with a date range and
 * belongs on Analytics, not on a triage screen. Stock value is not the same thing —
 * it is a valuation with no period, which is why it is allowed here.
 *
 * Every figure comes from `GET /orders/summary`, computed in the database over the
 * whole table and scoped to the caller's branch. There is no client-side tally
 * here, by design — a number derived from page 1 of a 20-row list is the defect
 * this page used to carry, and it is exactly the defect the Inventory page's
 * totals had before they moved here.
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

  // First load: nothing to show yet. The Workspace is two rows — four order
  // queues over three stock figures — so the placeholder is the same two rows,
  // spaced the same way. No `min-h-64`: it would reserve 256px for rows that are
  // 84px tall.
  if (isLoading && !summary) {
    return <TileRowSkeleton columns={[4, 3]} />;
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

  const queueCards: Array<{ label: string; count: number; to: string }> = [
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
  ];

  /*
   * "Waiting" is the four queues plus low stock, and low stock still counts even
   * though its tile has moved to the row below — a shelf at or under its reorder
   * level is work somebody has to do. Keeping it in the sum is what stops the note
   * reading "every queue is clear" while a low-stock figure sits on screen beside
   * it: the note only appears when the sum is zero, which means low stock is zero
   * too.
   */
  const workWaiting = queueCards.reduce((total, card) => total + card.count, 0) + summary.lowStock;

  return (
    <div className="space-y-5">
      {/* A background reload failed but the last good counts are still on screen —
          keep them, and say they may be behind. */}
      {error && <InlineAlert message={`${error} Showing the last known counts.`} />}

      <StatTileRow columns={4}>
        {queueCards.map((card) => (
          <StatTile key={card.label} label={card.label} value={card.count} to={card.to} />
        ))}
      </StatTileRow>

      {/*
        Inventory's three figures, moved here from the top of the Inventory page.
        Total Stock and Stock Value are plain cards — the inventory list has no
        filter that could answer them — while Low Stock keeps its link to the
        filtered list, which is the point of a number card in this app.
      */}
      <StatTileRow columns={3}>
        <StatTile label="Total Stock" value={summary.totalStock.toLocaleString()} />
        <StatTile label="Stock Value" value={`₱${summary.totalValue.toFixed(2)}`} />
        <StatTile label="Low Stock" value={summary.lowStock.toLocaleString()} to="/inventory?lowStock=1" />
      </StatTileRow>

      {workWaiting === 0 && (
        <p className="text-xs text-app-text-muted dark:text-zinc-400">
          Nothing is waiting right now — every queue is clear.
        </p>
      )}
    </div>
  );
}
