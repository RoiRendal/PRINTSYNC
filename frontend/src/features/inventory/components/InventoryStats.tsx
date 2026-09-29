import { StatTile, StatTileRow } from '../../../shared/components/ui';
import type { InventoryStats } from '../hooks/useFilteredInventory';

/**
 * Inventory's three figures, as the app's one stat tile.
 *
 * This used to own a local `cards` tuple whose third member was a tone — accent
 * on total stock, green on the peso value, orange on low stock. The tone is
 * gone, and that is the point of the change: ERPNext's number card never
 * colours a figure, and neither does `StatTile`. A green ₱ and an orange count
 * said "good" and "bad" using the same channel the label already uses to say
 * what the number is, so the colour carried no information the words did not —
 * and it made these three tiles unlike every other tile in the app.
 *
 * Low stock above zero is still visible: the tile names it, and the inventory
 * page it sits on carries the low-stock filter the figure used to shout about.
 */
interface InventoryStatsProps {
  stats: InventoryStats;
}

export function InventoryStats({ stats }: InventoryStatsProps) {
  return (
    <StatTileRow columns={3}>
      <StatTile label="Total Stock" value={stats.totalStock.toLocaleString()} />
      <StatTile label="Stock Value" value={`₱${stats.totalValue.toFixed(2)}`} />
      <StatTile label="Low Stock" value={stats.lowStock.toLocaleString()} />
    </StatTileRow>
  );
}
