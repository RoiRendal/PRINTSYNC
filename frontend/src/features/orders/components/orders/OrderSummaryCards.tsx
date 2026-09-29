import { StatTile, StatTileRow } from '../../../../shared/components/ui';
import type { Order } from '../../types';

/**
 * The four production-phase counts, as the app's one stat tile.
 *
 * This row used to be the only one in the app laid out sideways — label on the
 * left, figure on the right — and it was the odd one out for no reason the page
 * could defend: the other six rows stacked their parts, and a reader moving
 * between Orders and Inventory had to re-learn where to look for the number.
 * The sideways layout was also the reason the label had to be `truncate`, which
 * is a tile admitting it cannot fit its own text.
 *
 * No icon and no tone — the same ERPNext rule the dashboard tiles follow: a card
 * carries its figure, not ornament.
 */
export function OrderSummaryCards({ orders }: { orders: Order[] }) {
  const orderSummary = [
    { label: 'Designing', count: orders.filter((o) => o.status === 'Designing').length },
    { label: 'In Production', count: orders.filter((o) => o.status === 'In Production').length },
    { label: 'Ready', count: orders.filter((o) => o.status === 'Ready for Pickup').length },
    { label: 'Total Active', count: orders.filter((o) => o.status !== 'Completed').length },
  ];

  return (
    <StatTileRow columns={4}>
      {orderSummary.map((card) => (
        <StatTile key={card.label} label={card.label} value={card.count} />
      ))}
    </StatTileRow>
  );
}
