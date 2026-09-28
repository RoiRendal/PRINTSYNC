import { SurfaceCard } from '../../../../shared/components/ui';
import type { Order } from '../../types';

/**
 * A phase count: label on the left, figure on the right.
 *
 * No icon and no ringed frame — the same ERPNext rule the analytics cards and
 * the dashboard tiles already follow: a card carries its figure, not ornament.
 * The glyph sat in a 40px ringed box that also carried the card's colour, so
 * removing it removes the per-phase tint with it; nothing on the card takes the
 * colour over, because the tint was decoration on the badge rather than
 * information the label does not already state.
 */
interface SummaryCardProps {
  label: string;
  count: number;
}

function SummaryCard({ label, count }: SummaryCardProps) {
  return (
    <div>
      <SurfaceCard className="flex items-center justify-between gap-3 p-3 md:p-4">
        <span className="truncate text-2xs font-bold text-macos-text-muted dark:text-zinc-500">{label}</span>
        <span className="tabular-nums text-xl font-bold tracking-tight text-macos-text dark:text-zinc-100">{count}</span>
      </SurfaceCard>
    </div>
  );
}

export function OrderSummaryCards({ orders }: { orders: Order[] }) {
  const orderSummary = [
    { label: 'Designing', count: orders.filter((o) => o.status === 'Designing').length },
    { label: 'In Production', count: orders.filter((o) => o.status === 'In Production').length },
    { label: 'Ready', count: orders.filter((o) => o.status === 'Ready for Pickup').length },
    { label: 'Total Active', count: orders.filter((o) => o.status !== 'Completed').length },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:gap-4">
      {orderSummary.map((card) => <SummaryCard key={card.label} {...card} />)}
    </div>
  );
}
