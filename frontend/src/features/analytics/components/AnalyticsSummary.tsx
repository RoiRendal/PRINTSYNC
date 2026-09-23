import { Activity, BarChart3, LineChart as LineChartIcon, TrendingUp, Wallet } from 'lucide-react';
import type { AnalyticsSummary as AnalyticsSummaryData } from '../api/analyticsApi';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { Badge } from '../../../shared/components/ui';
import { money } from './analytics-types';
import { MetricTile } from './MetricTile';
import { SectionCard } from './SectionCard';

interface AnalyticsSummaryProps {
  summary: AnalyticsSummaryData | null;
  error: string | null;
  isLoading: boolean;
}

export function AnalyticsSummary({ summary, error, isLoading }: AnalyticsSummaryProps) {
  return (
    <SectionCard
      icon={Activity}
      title="Operational Summary"
      description="Live reporting snapshot from current year-to-date data."
      controls={summary && <Badge variant="blue">{summary.range.from} → {summary.range.to}</Badge>}
    >
      {isLoading ? <LoadingState label="Loading report" /> : error ? <ErrorState message={error} /> : summary ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <MetricTile label="Revenue" value={money.format(summary.revenue)} tone="blue" icon={Wallet} />
            <MetricTile label="Transactions" value={summary.transactionCount.toLocaleString()} icon={Activity} />
            <MetricTile label="Orders" value={summary.orderCount.toLocaleString()} tone="purple" icon={BarChart3} />
            <MetricTile label="Avg ticket" value={money.format(summary.averageTransactionValue)} tone="green" icon={TrendingUp} />
            <MetricTile label="Inventory alerts" value={summary.inventoryAlerts.toLocaleString()} tone={summary.inventoryAlerts > 0 ? 'orange' : 'neutral'} icon={LineChartIcon} />
          </div>
          {summary.topItems.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <p className="mb-2 label-caps text-macos-text-muted dark:text-zinc-500">Top items by revenue</p>
              <div className="flex flex-wrap gap-2">
                {summary.topItems.slice(0, 5).map((item) => <Badge key={item.name} variant="gray">{item.name} · {money.format(item.revenue)}</Badge>)}
              </div>
            </div>
          )}
        </>
      ) : null}
    </SectionCard>
  );
}
