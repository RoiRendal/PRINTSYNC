import type { BranchComparison } from '../api/analyticsApi';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { AnalyticsSectionSkeleton } from './AnalyticsSectionSkeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  cellTitle,
} from '../../../shared/components/ui';
import { money } from './analytics-types';
import { SectionCard } from './SectionCard';

interface BranchComparisonSectionProps {
  comparison: BranchComparison | null;
  error: string | null;
  isLoading: boolean;
}

/** One row of the comparison table — a branch, plus its share of the total. */
interface ComparisonRow {
  key: string;
  name: string;
  code: string;
  revenue: number;
  transactionCount: number;
  orderCount: number;
  averageTransactionValue: number;
  /** Revenue as a percentage of the combined figure. */
  share: number;
  isCombined: boolean;
}

/**
 * Balayan vs Nasugbu over one period — the thing the owner actually asked for.
 *
 * ### Why a table and not a chart
 *
 * A grouped bar chart of two numbers is taller than the two numbers. The question
 * here is "which branch did better, and by how much", which is a handful of figures
 * read side by side; a table answers it in one glance, in the app's own money
 * format. Change over time is already shown by the Sales Timeline panel, per branch,
 * once the selector is used — a second chart here would be a second picture of the
 * same data, free to disagree with the first.
 *
 * ### Why the combined row sits in the same table
 *
 * The server computes the combined figure from its own read rather than summing the
 * branch rows — so if the parts ever fail to add up to the total, a reader sees it
 * in the row below. A "combined" tile elsewhere on the page would hide exactly the
 * discrepancy worth noticing.
 *
 * ### Why there is no actions column
 *
 * Standing rule: a new table carries no per-row action buttons. Nothing here is
 * clickable — it is a report.
 */
export function BranchComparisonSection({ comparison, error, isLoading }: BranchComparisonSectionProps) {
  const rows: ComparisonRow[] = [];
  if (comparison) {
    const total = comparison.combined.revenue;
    const shareOf = (revenue: number) => (total === 0 ? 0 : (revenue / total) * 100);

    for (const branch of comparison.branches) {
      rows.push({
        key: branch.branchId,
        name: branch.name,
        code: branch.code,
        revenue: branch.revenue,
        transactionCount: branch.transactionCount,
        orderCount: branch.orderCount,
        averageTransactionValue: branch.averageTransactionValue,
        share: shareOf(branch.revenue),
        isCombined: false,
      });
    }
    rows.push({
      key: '__combined__',
      name: 'All branches',
      code: '—',
      revenue: comparison.combined.revenue,
      transactionCount: comparison.combined.transactionCount,
      orderCount: comparison.combined.orderCount,
      averageTransactionValue: comparison.combined.averageTransactionValue,
      share: 100,
      isCombined: true,
    });
  }

  return (
    <SectionCard
      title="Branch Comparison"
      description="Balayan and Nasugbu side by side for the selected period. Head office only."
    >
      {isLoading ? (
        <AnalyticsSectionSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : comparison ? (
        <TableContainer className="rounded-none border-0 bg-transparent">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Branch</TableHead>
                <TableHead>Code</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Share</TableHead>
                <TableHead className="text-right">Transactions</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Avg ticket</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.key}
                  className={row.isCombined ? 'bg-[var(--app-state-hover)] font-semibold' : undefined}
                >
                  <TableCell title={cellTitle('Branch', row.name)}>{row.name}</TableCell>
                  <TableCell>{row.code}</TableCell>
                  <TableCell className="text-right">{money.format(row.revenue)}</TableCell>
                  <TableCell className="text-right">{row.share.toFixed(1)}%</TableCell>
                  <TableCell className="text-right">{row.transactionCount.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{row.orderCount.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{money.format(row.averageTransactionValue)}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="py-4 text-center text-app-text-muted dark:text-zinc-400">
                    No branches are active yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}
    </SectionCard>
  );
}
