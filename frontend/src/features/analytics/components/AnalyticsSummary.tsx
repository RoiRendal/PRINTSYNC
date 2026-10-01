import type { AnalyticsSummary as AnalyticsSummaryData } from '../api/analyticsApi';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { TileRowSkeleton } from '../../../shared/components/feedback/TileRowSkeleton';
import { Badge, StatTile, StatTileRow } from '../../../shared/components/ui';
import { money } from './analytics-types';
import { SectionCard } from './SectionCard';

interface AnalyticsSummaryProps {
  summary: AnalyticsSummaryData | null;
  error: string | null;
  isLoading: boolean;
}

export function AnalyticsSummary({ summary, error, isLoading }: AnalyticsSummaryProps) {
  return (
    <SectionCard
      title="Operational Summary"
      description="Live reporting snapshot from current year-to-date data."
      controls={summary && <Badge variant="accent">{summary.range.from} → {summary.range.to}</Badge>}
    >
      {isLoading ? <TileRowSkeleton columns={5} /> : error ? <ErrorState message={error} /> : summary ? (
        <>
          <StatTileRow columns={5}>
            <StatTile label="Revenue" value={money.format(summary.revenue)} />
            <StatTile label="Transactions" value={summary.transactionCount.toLocaleString()} />
            <StatTile label="Orders" value={summary.orderCount.toLocaleString()} />
            <StatTile label="Avg ticket" value={money.format(summary.averageTransactionValue)} />
            <StatTile label="Inventory alerts" value={summary.inventoryAlerts.toLocaleString()} />
          </StatTileRow>
          {summary.topItems.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <p className="mb-2 label-caps text-app-text-muted dark:text-zinc-500">Top items by revenue</p>
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
