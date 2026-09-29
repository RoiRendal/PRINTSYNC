import { StatTile, StatTileRow } from '../../../../shared/components/ui';
import { useOrdersSummary } from '../../hooks/useOrdersSummary';
import type { OrderStatus, OrdersSummary } from '../../types';

/** Reads one status's count from the zero-filled `byStatus` array. */
function countFor(summary: OrdersSummary, status: OrderStatus): number {
  return summary.byStatus.find((entry) => entry.status === status)?.count ?? 0;
}

/**
 * The four production-phase counts, as the app's one stat tile.
 *
 * This row used to derive its numbers from the orders loaded on the page — page 1 of
 * a 20-row list — so "Designing" could read a different, lower number than the same
 * tile on the Dashboard. It now reads `GET /orders/summary`, computed in the database
 * over the whole table, so the two pages agree. The Orders and Dashboard counts are
 * the same source on purpose (see the summary hook): one label, one truth.
 *
 * No icon and no tone — the same ERPNext rule the dashboard tiles follow: a card
 * carries its figure, not ornament.
 */
export function OrderSummaryCards() {
  const { summary } = useOrdersSummary();
  if (!summary) return null;

  const cards: Array<{ label: string; count: number }> = [
    { label: 'Designing', count: countFor(summary, 'Designing') },
    { label: 'In Production', count: countFor(summary, 'In Production') },
    { label: 'Ready', count: countFor(summary, 'Ready for Pickup') },
    { label: 'Total Active', count: summary.total - countFor(summary, 'Completed') },
  ];

  return (
    <StatTileRow columns={4}>
      {cards.map((card) => (
        <StatTile key={card.label} label={card.label} value={card.count} />
      ))}
    </StatTileRow>
  );
}
