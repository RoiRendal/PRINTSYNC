import type { LucideIcon } from 'lucide-react';
import { CheckCircle2, ClipboardList, Eye, Printer } from 'lucide-react';
import { SurfaceCard } from '../../../../shared/components/ui';
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
  purple: 'text-purple-700 ring-[var(--app-border-hairline)] dark:text-purple-300',
  blue: 'text-macos-blue ring-[var(--app-border-hairline)] dark:text-macos-cyan',
  green: 'text-green-700 ring-[var(--app-border-hairline)] dark:text-green-300',
  orange: 'text-orange-700 ring-[var(--app-border-hairline)] dark:text-orange-300',
};

function SummaryCard({ label, icon: Icon, count, tone }: SummaryCardProps) {
  return (
    <div>
      <SurfaceCard className="flex items-center justify-between gap-3 p-3 md:p-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.95rem] ring-1', summaryToneClasses[tone])}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <span className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-macos-text-muted dark:text-zinc-500">{label}</span>
        </div>
        <span className="font-mono text-xl font-bold tracking-tight text-macos-text dark:text-zinc-100">{count}</span>
      </SurfaceCard>
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
