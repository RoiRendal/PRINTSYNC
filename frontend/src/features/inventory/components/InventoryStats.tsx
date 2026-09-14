import { motion } from 'motion/react';
import { GlassCard } from '../../../shared/components/ui';
import { cn } from '../../../shared/lib/cn';
import type { InventoryStats } from '../hooks/useFilteredInventory';

interface InventoryStatsProps {
  stats: InventoryStats;
}

export function InventoryStats({ stats }: InventoryStatsProps) {
  const cards: Array<[string, string, string]> = [
    ['Total Stock', stats.totalStock.toLocaleString(), 'blue'],
    ['Stock Value', `₱${stats.totalValue.toFixed(2)}`, 'green'],
    ['Low Stock', stats.lowStock.toLocaleString(), stats.lowStock > 0 ? 'orange' : 'gray'],
  ];

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {cards.map(([label, value, tone]) => (
        <motion.div key={label} whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 360, damping: 26 }}>
          <GlassCard className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-macos-text-muted dark:text-zinc-500">{label}</p>
            <p className={cn('mt-2 font-mono text-xl font-bold', tone === 'blue' && 'text-macos-blue dark:text-macos-cyan', tone === 'green' && 'text-green-700 dark:text-green-300', tone === 'orange' && 'text-orange-700 dark:text-orange-300', tone === 'gray' && 'text-macos-text dark:text-zinc-100')}>{value}</p>
          </GlassCard>
        </motion.div>
      ))}
    </div>
  );
}
