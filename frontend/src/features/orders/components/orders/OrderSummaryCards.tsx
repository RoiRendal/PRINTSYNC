import type { LucideIcon } from 'lucide-react';
import { CheckCircle2, ClipboardList, Eye, Printer } from 'lucide-react';
import { GlassCard } from '../../../../shared/components/ui';
import { cn } from '../../../../shared/lib/cn';
import type { Order } from '../../types';

type SummaryTone = 'purple' | 'blue' | 'green' | 'orange';

interface SummaryCardProps {
  label: string;
  icon: LucideIcon;
  count: number;
  tone: SummaryTone;
}

const summaryToneClasses: Record<SummaryTone, string> = {
  purple: 'from-macos-purple/20 text-purple-700 ring-macos-purple/25 dark:text-purple-300',
  blue: 'from-macos-blue/20 text-macos-blue ring-macos-blue/25 dark:text-macos-cyan',
  green: 'from-macos-green/20 text-green-700 ring-macos-green/25 dark:text-green-300',
  orange: 'from-macos-orange/20 text-orange-700 ring-macos-orange/25 dark:text-orange-300',
};

function SummaryCard({ label, icon: Icon, count, tone }: SummaryCardProps) {
  return (
    <div>
      <GlassCard className="flex items-center justify-between gap-3 p-3 md:p-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.95rem] bg-gradient-to-br to-white/50 shadow-[var(--shadow-card)] ring-1 dark:to-white/5', summaryToneClasses[tone])}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <span className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-macos-text-muted">{label}</span>
        </div>
        <span className="font-mono text-xl font-bold tracking-tight text-macos-text dark:text-zinc-100">{count}</span>
      </GlassCard>
    </div>
  );
}

export function OrderSummaryCards({ orders }: { orders: Order[] }) {
  const orderSummary = [
    { label: 'Designing', icon: Eye, count: orders.filter((o) => o.status === 'Designing').length, tone: 'purple' as const },
    { label: 'In Production', icon: Printer, count: orders.filter((o) => o.status === 'In Production').length, tone: 'blue' as const },
    { label: 'Ready', icon: CheckCircle2, count: orders.filter((o) => o.status === 'Ready for Pickup').length, tone: 'green' as const },
    { label: 'Total Active', icon: ClipboardList, count: orders.filter((o) => o.status !== 'Completed').length, tone: 'orange' as const },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:gap-4">
      {orderSummary.map((card) => <SummaryCard key={card.label} {...card} />)}
    </div>
  );
}
