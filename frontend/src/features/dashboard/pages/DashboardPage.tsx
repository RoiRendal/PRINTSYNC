import { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, CheckCircle2, DollarSign, PackageSearch, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
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
import { useInventory } from '../../../app/stores/useInventoryStore';
import { useOrders } from '../../../app/stores/useOrderStore';
import { isCustomOrder } from '../../orders/utils/orderType';

type StatTone = 'green' | 'blue' | 'red' | 'purple';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  tone: StatTone;
  detail: string;
}

/*
 * Phase 6: the tone is now the icon's colour and nothing else.
 *
 * It used to be a three-part thing — `from-macos-green/20` tinted the chip's
 * gradient, `ring-macos-green/20` drew its outline and `text-green-700` coloured
 * the glyph. The tint and the ring are both gone, because the chip is no longer
 * a lit pill but a recessed well (see `StatCard` below), and a well that is
 * tinted is not a well — it is a coloured sticker sitting in a hole.
 *
 * What is left is the part that was doing the work: four cards, four glyph
 * colours, one neutral recess. The signal a reader actually needs is "which
 * card is the alert", and that arrives through the icon and the number.
 */
const statToneClasses: Record<StatTone, string> = {
  green: 'text-green-700 dark:text-green-300',
  blue: 'text-macos-blue dark:text-macos-cyan',
  red: 'text-red-700 dark:text-red-300',
  purple: 'text-purple-700 dark:text-purple-300',
};

/*
 * A navigation link that has to look like a primary key.
 *
 * It stays a `<Link>` rather than becoming a `<Button onClick={navigate}>` so
 * the browser keeps the affordances of a real anchor — middle-click, open in a
 * new tab, the status-bar preview on hover. A `navigate()` call silently throws
 * all three away for a control whose entire job is to go somewhere.
 *
 * The recipe is `Button`'s `primary`/`md` recipe: `.ambient` at elevation 1,
 * plus `.mat-press` for the pressed depth and `.mat-focus` for the outline.
 * It is repeated here rather than exported from `Button.tsx` so that a phase
 * about the dashboard does not have to widen the button's public API for two
 * call sites. If a third one appears, that is the moment to export it.
 *
 * Two classes it replaces are worth naming, because neither was doing what it
 * looked like it was doing:
 *
 *   - `shadow-[0_8px_22px_rgb(0_122_255/0.24)]` was a *blue* glow behind a
 *     button whose own colour is `--color-macos-blue`, which is grey
 *     (`#555558`). It had been the wrong colour since the palette was
 *     de-Apple'd — and `.ambient` is unlayered and owns `box-shadow`, so it was
 *     already inert anyway.
 *   - `active:scale-[0.98]` shrank the link when pressed. That is the glass
 *     gesture the redesign removes: a key sinks inward, it does not get smaller.
 */
const ctaClasses =
  'ambient amb-elevation-1 mat-press mat-focus inline-flex h-9 items-center justify-center rounded-[var(--radius-button)] bg-macos-blue px-4 text-xs font-semibold text-white transition-colors duration-200 hover:bg-macos-blue-dark dark:bg-macos-blue-dark dark:hover:bg-macos-blue';

function StatCard({ title, value, icon: Icon, tone, detail }: StatCardProps) {
  return (
    <div>
      <GlassCard className="h-full p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-macos-text-muted">{title}</p>
            <p className="mt-2 truncate font-mono text-2xl font-bold tracking-tight text-macos-text dark:text-zinc-100">{value}</p>
          </div>
          {/*
            * The medallion: a well punched into the card, not a chip resting on
            * it. `amb-groove mat-well` is the same pair the POS cart tray, the
            * product image well and `Input` already use, so this is the app's
            * established recessed idiom rather than a new one — and `mat-well`
            * is what keeps the well `--app-surface` instead of letting the
            * engine paint its own `--amb-albedo`, which would come out grey in
            * light and *lighter* than the card in dark.
            *
            * The gradient is gone: `bg-gradient-to-br to-white/50` was a
            * highlight pretending to be a lit dome, which is the single most
            * recognisable glass artifact on this page.
            */}
          <div className={cn('amb-groove mat-well flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border border-[var(--app-hairline)]', statToneClasses[tone])}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-macos-text-muted">{detail}</p>
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
          {/* "Liquid Glass command center" outlived the glass it named. */}
          <p className="mt-1 text-sm text-macos-text-muted">
            Monitor revenue, production flow, and material health from one command center.
          </p>
        </div>
        <Link to="/orders" className={ctaClasses}>
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
        {/*
          * The container keeps `variant="elevated"`.
          *
          * Flattening it to `solid` was the first instinct and it was the wrong
          * one: `elevated` is the app's idiom for a large table panel, and
          * eleven other call sites use it — Orders, Inventory, Customers, Users,
          * Audit, Designs, Settings and the POS history view. Changing one of
          * thirteen would not have made the dashboard quieter, it would have
          * made it the odd page out. If the elevation ladder wants revisiting
          * for full-page panels then that is one decision applied to all
          * thirteen, and it belongs in the sweep.
          *
          * What did change here is the header's divider. It was
          * `border-black/5 dark:border-white/10` — a pair of literals — while
          * the Stock Vitality header further down the same file already used
          * `--app-hairline`. Two dividers, one page, two values; now one token,
          * and it follows the theme without a `dark:` partner.
          *
          * The table inside is deliberately untouched and stays flat. Dense data
          * is the one place the Boss asked for legibility over material.
          */}
        <Card className="xl:col-span-3" padding="none" variant="elevated">
          <CardHeader className="mb-0 flex-row items-center justify-between gap-3 border-b border-[var(--app-hairline)] p-4">
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
          <div className="mb-4 flex items-start justify-between gap-3 border-b border-[var(--app-hairline)] pb-3">
            <div>
              <CardTitle>Stock Vitality</CardTitle>
              <CardDescription>Top materials by current availability.</CardDescription>
            </div>
            <div className="amb-groove mat-well flex h-10 w-10 items-center justify-center rounded-[0.9rem] border border-[var(--app-hairline)] text-macos-blue dark:text-macos-cyan">
              <PackageSearch className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>

          <div className="flex-1 space-y-4">
            {inventorySnapshot.map((item) => {
              const isLow = item.stock <= item.reorderLevel;
              /*
               * Unchanged arithmetic, deliberately. The bar is static — it has no
               * animation and no transition — so this is the only thing that
               * decides what the reader sees, and it was re-derived rather than
               * assumed:
               *
               *   capacity  = max(reorderLevel * 3, stock, 1)
               *   stockPercent = min(100, round(stock / capacity * 100))
               *
               * The `1` floor stops a zero-stock item with a zero reorder level
               * from dividing by zero; the `max(stock, …)` term means an item
               * that is *above* three times its reorder level pins to 100%
               * rather than overflowing. Both bars below are therefore in
               * 0..100 by construction, which is what `width: ${n}%` needs.
               */
              const capacity = Math.max(item.reorderLevel * 3, item.stock, 1);
              const stockPercent = Math.min(100, Math.round((item.stock / capacity) * 100));

              return (
                <div key={item.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-[11px] font-semibold">
                    <span className="truncate text-macos-text dark:text-zinc-200">{item.name}</span>
                    <span className={cn('font-mono', isLow ? 'text-macos-red dark:text-red-300' : 'text-macos-text-muted')}>{item.stock}</span>
                  </div>
                  {/*
                    * A channel with a slug in it, rather than a track with a
                    * stripe painted on.
                    *
                    * The track is the groove; the fill is raised inside it. That
                    * is why the track grew from `h-2` to `h-3` and gained `p-0.5`
                    * — an 8px bar has no room for a bevel, so the fill would
                    * have been a flat stripe again no matter what class it
                    * carried. `overflow-hidden` is gone for the same reason: it
                    * clipped the fill's cast shadow, which is the whole point of
                    * raising it, and it is no longer needed because the fill is
                    * inset by the padding and its own cap is concentric with the
                    * track's (verified: at 100% width the fill's rightmost point
                    * sits 1.5px inside the track's boundary at the same height).
                    *
                    * The fill's blue→cyan gradient is gone. A gradient across an
                    * 8px slug is invisible at best and reads as a lit tube at
                    * worst; the colour is now a flat `--color-macos-blue`, with
                    * red kept for the low-stock case.
                    */}
                  <div className="amb-groove mat-well h-3 rounded-full p-0.5">
                    <div
                      className={cn('ambient amb-elevation-0 h-full rounded-full', isLow ? 'bg-macos-red' : 'bg-macos-blue')}
                      style={{ width: `${stockPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {inventorySnapshot.length === 0 && <EmptyState title="No inventory items" message="Add materials to start monitoring stock vitality." className="py-8" />}
          </div>

          <div className="mt-6 rounded-[var(--radius-card)] border border-[var(--app-hairline)] bg-[var(--app-surface-raised)] p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-macos-text-muted">Inventory Management</p>
            <Link to="/inventory" className={cn(ctaClasses, 'w-full')}>
              Restock Now
            </Link>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
