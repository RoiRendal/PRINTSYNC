import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Wallet } from 'lucide-react';
import type { SalesTimeline } from '../api/analyticsApi';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import {
  Badge,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../shared/components/ui';
import {
  chartTooltipStyle,
  generateInsight,
  createEmptyInsightState,
  money,
  periodLabel,
  type InsightState,
  type Period,
} from './analytics-types';
import { InsightPanel } from './InsightPanel';
import { MetricTile } from './MetricTile';
import { PeriodSelector } from './PeriodSelector';
import { SectionCard } from './SectionCard';

interface ProfitMarginSectionProps {
  profitTimeline: SalesTimeline | null;
  error: string | null;
  isLoading: boolean;
  profitPeriod: Period;
  onProfitPeriodChange: (period: Period) => void;
}

export function ProfitMarginSection({
  profitTimeline,
  error,
  isLoading,
  profitPeriod,
  onProfitPeriodChange,
}: ProfitMarginSectionProps) {
  const [marginSortOrder, setMarginSortOrder] = useState<'desc' | 'asc'>('desc');
  const [profitInsight, setProfitInsight] = useState<InsightState>(createEmptyInsightState());

  const profitMarginData = useMemo(() => {
    if (!profitTimeline) return [];
    return profitTimeline.buckets.map((bucket) => ({ label: bucket.label, revenue: bucket.revenue, expenses: bucket.cogs, profit: bucket.grossProfit, margin: bucket.margin }));
  }, [profitTimeline]);

  const profitMarginStats = useMemo(() => {
    const totalRevenue = profitMarginData.reduce((acc, item) => acc + item.revenue, 0);
    const totalExpenses = profitMarginData.reduce((acc, item) => acc + item.expenses, 0);
    const totalProfit = totalRevenue - totalExpenses;
    const averageMargin = totalRevenue === 0 ? 0 : (totalProfit / totalRevenue) * 100;
    const bestPoint = profitMarginData.reduce((best, item) => (item.margin > best.margin ? item : best), profitMarginData[0] ?? { label: '-', margin: 0 });
    const lowestPoint = profitMarginData.reduce((lowest, item) => (item.margin < lowest.margin ? item : lowest), profitMarginData[0] ?? { label: '-', margin: 0 });
    return { totalRevenue, totalExpenses, totalProfit, averageMargin, bestPoint, lowestPoint };
  }, [profitMarginData]);

  const sortedMarginRows = useMemo(() => [...profitMarginData].sort((a, b) => marginSortOrder === 'desc' ? b.margin - a.margin : a.margin - b.margin), [profitMarginData, marginSortOrder]);

  const generateProfitInsight = useCallback(async () => {
    setProfitInsight((prev) => ({ ...prev, isLoading: true }));
    const report = await generateInsight('profit', { avgMargin: profitMarginStats.averageMargin, totalProfit: profitMarginStats.totalProfit, bestLabel: profitMarginStats.bestPoint.label, lowestLabel: profitMarginStats.lowestPoint.label });
    setProfitInsight((prev) => ({ ...prev, isLoading: false, report, lastGeneratedAt: new Date().toISOString() }));
  }, [profitMarginStats.averageMargin, profitMarginStats.totalProfit, profitMarginStats.bestPoint.label, profitMarginStats.lowestPoint.label]);

  useEffect(() => { if (profitInsight.autoGenerate) void generateProfitInsight(); }, [profitInsight.autoGenerate, generateProfitInsight]);

  return (
    <SectionCard
      icon={Wallet}
      title="Profit Margin Analysis"
      description={`Revenue vs COGS with margin trend across all ${periodLabel[profitPeriod].toLowerCase()} buckets.`}
      controls={<PeriodSelector value={profitPeriod} onChange={onProfitPeriodChange} prefix="profit" />}
    >
      {isLoading ? <LoadingState label="Loading profit data" /> : error ? <ErrorState message={error} /> : profitMarginData.length === 0 ? <p className="text-xs text-macos-text-muted">No transaction data available for this period.</p> : (
        <>
          <InsightPanel state={profitInsight} onToggleAutoGenerate={() => setProfitInsight((prev) => ({ ...prev, autoGenerate: !prev.autoGenerate }))} onGenerate={generateProfitInsight} />
          <div className="my-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricTile label="Revenue" value={money.format(profitMarginStats.totalRevenue)} tone="blue" />
            <MetricTile label="COGS" value={money.format(profitMarginStats.totalExpenses)} tone="orange" />
            <MetricTile label="Gross Profit" value={money.format(profitMarginStats.totalProfit)} tone="green" />
            <MetricTile label="Avg Margin" value={`${profitMarginStats.averageMargin.toFixed(1)}%`} />
          </div>
          <div className="h-[360px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={profitMarginData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(142,142,147,0.24)" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#86868B' }} />
                <YAxis yAxisId="amount" tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#86868B' }} />
                <YAxis yAxisId="margin" orientation="right" tickFormatter={(value) => `${value.toFixed(0)}%`} domain={[0, 50]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#86868B' }} />
                <RechartsTooltip formatter={(value, name) => { const numericValue = Number(value ?? 0); const label = String(name); if (label === 'Margin %') return [`${numericValue.toFixed(1)}%`, label]; return [money.format(numericValue), label]; }} labelStyle={{ color: '#1D1D1F', fontSize: 12 }} contentStyle={chartTooltipStyle} />
                <Legend />
                <Bar yAxisId="amount" dataKey="revenue" name="Revenue" fill="#555558" radius={[8, 8, 0, 0]} animationDuration={700} />
                <Bar yAxisId="amount" dataKey="expenses" name="COGS" fill="#AF52DE" radius={[8, 8, 0, 0]} animationDuration={700} />
                <Line yAxisId="margin" type="monotone" dataKey="margin" name="Margin %" stroke="#34C759" strokeWidth={3} dot={{ r: 4 }} animationDuration={700} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-macos-text-muted">
            <Badge variant="green">Best: {profitMarginStats.bestPoint.label} ({profitMarginStats.bestPoint.margin.toFixed(1)}%)</Badge>
            <Badge variant="orange">Lowest: {profitMarginStats.lowestPoint.label} ({profitMarginStats.lowestPoint.margin.toFixed(1)}%)</Badge>
          </div>
          <TableContainer className="mt-4">
            <div className="flex items-center justify-between border-b border-black/5 p-3 dark:border-white/10">
              <p className="text-xs font-bold text-macos-text dark:text-zinc-100">Margin Ranking Table</p>
              <Select fieldSize="sm" className="w-44" value={marginSortOrder} onChange={(event) => setMarginSortOrder(event.target.value as 'desc' | 'asc')}>
                <option value="desc">Highest to Lowest</option>
                <option value="asc">Lowest to Highest</option>
              </Select>
            </div>
            <Table>
              <TableHeader><TableRow className="hover:bg-transparent"><TableHead>Segment</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">COGS</TableHead><TableHead className="text-right">Profit</TableHead><TableHead className="text-right">Margin</TableHead></TableRow></TableHeader>
              <TableBody>{sortedMarginRows.map((row) => <TableRow key={row.label}><TableCell className="font-bold text-macos-text dark:text-zinc-100">{row.label}</TableCell><TableCell className="text-right">{money.format(row.revenue)}</TableCell><TableCell className="text-right">{money.format(row.expenses)}</TableCell><TableCell className="text-right text-green-700 dark:text-green-300">{money.format(row.profit)}</TableCell><TableCell className="text-right font-bold text-macos-text dark:text-zinc-100">{row.margin.toFixed(1)}%</TableCell></TableRow>)}</TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </SectionCard>
  );
}
