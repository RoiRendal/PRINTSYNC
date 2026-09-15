import { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, CheckCircle2, DollarSign, PackageSearch, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  GlassCard,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  getStatusBadgeVariant,
} from '../../../shared/components/ui';
import { cn } from '../../../shared/lib/cn';
import { useInventory } from '../../inventory/state/InventoryContext';
import { useOrders } from '../../orders/state/OrderContext';
import { isCustomOrder } from '../../orders/utils/orderType';

type StatTone = 'green' | 'blue' | 'red' | 'purple';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  tone: StatTone;
  detail: string;
}

const statToneClasses: Record<StatTone, string> = {
  green: 'from-macos-green/20 text-green-700 ring-macos-green/20 dark:text-green-300',
  blue: 'from-macos-blue/20 text-macos-blue ring-macos-blue/20 dark:text-macos-cyan',
  red: 'from-macos-red/20 text-red-700 ring-macos-red/20 dark:text-red-300',
  purple: 'from-macos-purple/20 text-purple-700 ring-macos-purple/20 dark:text-purple-300',
};

function StatCard({ title, value, icon: Icon, tone, detail }: StatCardProps) {
  return (
    <div>
      <GlassCard className="h-full p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-macos-text-muted dark:text-zinc-500">{title}</p>
            <p className="mt-2 truncate font-mono text-2xl font-bold tracking-tight text-macos-text dark:text-zinc-100">{value}</p>
          </div>
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] bg-gradient-to-br to-white/50 shadow-[var(--shadow-card)] ring-1 backdrop-blur-xl dark:to-white/5', statToneClasses[tone])}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-macos-text-muted dark:text-zinc-400">{detail}</p>
      </GlassCard>
    </div>
  );
}

export default function Dashboard() {
  const { items: inventory } = useInventory();
  const { orders } = useOrders();

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayRevenue = orders
      .filter((order) => order.date === today)
      .reduce((total, order) => total + order.amount, 0);

    const pendingJobs = orders.filter((order) => order.status !== 'Completed' && order.status !== 'Delivered').length;
    const inventoryAlerts = inventory.filter((item) => item.stock <= item.reorderLevel).length;
    const completedToday = orders.filter((order) => order.status === 'Completed' && order.date === today).length;

    return {
      todayRevenue,
      pendingJobs,
      inventoryAlerts,
      completedToday,
    };
  }, [orders, inventory]);

  const productionQueue = useMemo(
    () => orders.filter((order) => order.status !== 'Completed' && order.status !== 'Delivered').slice(0, 8),
    [orders],
  );

  const inventorySnapshot = useMemo(() => inventory.slice(0, 6), [inventory]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>

          <h1 className="text-2xl font-bold tracking-tight text-macos-text dark:text-zinc-100 lg:text-[28px]">Dashboard</h1>
          <p className="mt-1 text-sm text-macos-text-muted dark:text-zinc-400">
            Monitor revenue, production flow, and material health from one Liquid Glass command center.
          </p>
        </div>
        <Link
          to="/orders"
          className="inline-flex h-9 items-center justify-center rounded-[var(--radius-button)] bg-macos-blue px-4 text-xs font-semibold text-white shadow-[0_8px_22px_rgb(0_122_255/0.24)] transition-all duration-200 hover:bg-macos-blue-dark active:scale-[0.98] dark:bg-macos-blue-dark dark:hover:bg-macos-blue"
        >
          Open Pipeline
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4 xl:gap-4">
        <StatCard title="Today's Revenue" value={`₱${stats.todayRevenue.toLocaleString()}`} icon={DollarSign} tone="green" detail="Posted sales for the current operating day." />
        <StatCard title="Active Orders" value={stats.pendingJobs} icon={ShoppingBag} tone="blue" detail="Jobs still moving through production." />
        <StatCard title="Inventory Alerts" value={stats.inventoryAlerts} icon={AlertTriangle} tone={stats.inventoryAlerts > 0 ? 'red' : 'green'} detail="Materials at or below reorder threshold." />
        <StatCard title="Completed Today" value={stats.completedToday} icon={CheckCircle2} tone="purple" detail="Orders marked complete today." />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4 xl:gap-5">
        <Card className="xl:col-span-3" padding="none" variant="elevated">
          <CardHeader className="mb-0 flex-row items-center justify-between gap-3 border-b border-black/5 p-4 dark:border-white/10">
            <div>
              <CardTitle>Production Pipeline</CardTitle>
              <CardDescription>Current print jobs awaiting completion or delivery.</CardDescription>
            </div>
            <Badge variant="blue" size="md">{productionQueue.length} active</Badge>
          </CardHeader>
          <CardContent>
            <TableContainer className="rounded-none border-0 bg-transparent shadow-none">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Ref ID</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Work Phase</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productionQueue.map((order) => {
                    const customOrder = isCustomOrder(order);
                    return (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono font-semibold text-macos-text dark:text-zinc-100">#{order.id.slice(-6)}</TableCell>
                        <TableCell className="font-semibold text-macos-text dark:text-zinc-100">{order.customer}</TableCell>
                        <TableCell>
                          <Badge variant={customOrder ? 'purple' : 'gray'}>{customOrder ? 'Custom' : 'Retail'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(order.status)}>{order.status}</Badge>
                        </TableCell>
                        <TableCell className="text-center font-mono">{order.quantity}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-macos-text dark:text-zinc-100">₱{order.amount.toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {productionQueue.length === 0 && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={6} className="py-12">
                        <EmptyState title="No active production jobs" message="Completed and delivered orders are clear from the live pipeline." />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        <GlassCard className="flex flex-col p-4 xl:p-5">
          <div className="mb-4 flex items-start justify-between gap-3 border-b border-white/35 pb-3 dark:border-white/10">
            <div>
              <CardTitle>Stock Vitality</CardTitle>
              <CardDescription>Top materials by current availability.</CardDescription>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-[0.9rem] bg-macos-blue/12 text-macos-blue shadow-[var(--shadow-card)] dark:text-macos-cyan">
              <PackageSearch className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>

          <div className="flex-1 space-y-4">
            {inventorySnapshot.map((item) => {
              const isLow = item.stock <= item.reorderLevel;
              const capacity = Math.max(item.reorderLevel * 3, item.stock, 1);
              const stockPercent = Math.min(100, Math.round((item.stock / capacity) * 100));

              return (
                <div key={item.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-[11px] font-semibold">
                    <span className="truncate text-macos-text dark:text-zinc-200">{item.name}</span>
                    <span className={cn('font-mono', isLow ? 'text-macos-red dark:text-red-300' : 'text-macos-text-muted dark:text-zinc-400')}>{item.stock}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/5 shadow-inner dark:bg-white/10">
                    <motion.div
                      className={cn('h-full rounded-full', isLow ? 'bg-macos-red' : 'bg-gradient-to-r from-macos-blue to-macos-cyan')}
                      initial={{ width: 0 }}
                      animate={{ width: `${stockPercent}%` }}
                      transition={{ type: 'spring', stiffness: 180, damping: 26 }}
                    />
                  </div>
                </div>
              );
            })}
            {inventorySnapshot.length === 0 && <EmptyState title="No inventory items" message="Add materials to start monitoring stock vitality." className="py-8" />}
          </div>

          <div className="mt-6 rounded-[var(--radius-card)] border border-white/45 bg-white/45 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/6">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-macos-text-muted dark:text-zinc-500">Inventory Management</p>
            <Link
              to="/inventory"
              className="inline-flex h-9 w-full items-center justify-center rounded-[var(--radius-button)] bg-macos-blue px-4 text-xs font-semibold text-white shadow-[0_8px_22px_rgb(0_122_255/0.24)] transition-all duration-200 hover:bg-macos-blue-dark active:scale-[0.98] dark:bg-macos-blue-dark dark:hover:bg-macos-blue"
            >
              Restock Now
            </Link>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
