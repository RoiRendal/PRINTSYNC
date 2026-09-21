import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, LineChart as LineChartIcon } from 'lucide-react';
import type { SalesTimeline } from '../api/analyticsApi';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { Select } from '../../../shared/components/ui';
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

interface SalesComparisonSectionProps {
  salesTimeline: SalesTimeline | null;
  error: string | null;
  isLoading: boolean;
  salesPeriod: Period;
  onSalesPeriodChange: (period: Period) => void;
}

export function SalesComparisonSection({
  salesTimeline,
  error,
  isLoading,
  salesPeriod,
  onSalesPeriodChange,
}: SalesComparisonSectionProps) {
  const [selectionA, setSelectionA] = useState('');
  const [selectionB, setSelectionB] = useState('');
  const [salesInsight, setSalesInsight] = useState<InsightState>(createEmptyInsightState());

  const salesBucketLabels = useMemo(() => salesTimeline?.buckets.map((b) => b.label) ?? [], [salesTimeline]);
  const safeSelectionA = salesBucketLabels.includes(selectionA) ? selectionA : salesBucketLabels[0] ?? '';
  const safeSelectionB = salesBucketLabels.includes(selectionB) ? selectionB : salesBucketLabels[Math.min(1, salesBucketLabels.length - 1)] ?? '';

  const comparisonData = useMemo(() => {
    if (!salesTimeline) return [];
    const bucketA = salesTimeline.buckets.find((b) => b.label === safeSelectionA);
    const bucketB = salesTimeline.buckets.find((b) => b.label === safeSelectionB);
    return [{ label: safeSelectionA || 'A', timelineA: bucketA?.revenue ?? 0, timelineB: bucketB?.revenue ?? 0, delta: (bucketA?.revenue ?? 0) - (bucketB?.revenue ?? 0) }];
  }, [salesTimeline, safeSelectionA, safeSelectionB]);

  const totals = useMemo(() => {
    const totalA = comparisonData.reduce((acc, item) => acc + item.timelineA, 0);
    const totalB = comparisonData.reduce((acc, item) => acc + item.timelineB, 0);
    const absoluteDiff = totalA - totalB;
    const growth = totalB === 0 ? 0 : (absoluteDiff / totalB) * 100;
    return { totalA, totalB, absoluteDiff, growth };
  }, [comparisonData]);

  const generateSalesInsight = useCallback(async () => {
    setSalesInsight((prev) => ({ ...prev, isLoading: true }));
    const report = await generateInsight('sales', { growth: totals.growth, totalA: totals.totalA, totalB: totals.totalB, selectionA: safeSelectionA, selectionB: safeSelectionB });
    setSalesInsight((prev) => ({ ...prev, isLoading: false, report, lastGeneratedAt: new Date().toISOString() }));
  }, [totals.growth, totals.totalA, totals.totalB, safeSelectionA, safeSelectionB]);

  useEffect(() => { if (salesInsight.autoGenerate) void generateSalesInsight(); }, [salesInsight.autoGenerate, generateSalesInsight]);

  return (
    <div className="space-y-5">
      <SectionCard
        icon={LineChartIcon}
        title="Comparative Sales Performance"
        description={`Compare two time periods by ${periodLabel[salesPeriod].toLowerCase()} sales using real transaction data.`}
        controls={<PeriodSelector value={salesPeriod} onChange={onSalesPeriodChange} prefix="sales" />}
      >
        {isLoading ? <LoadingState label="Loading sales timeline" /> : error ? <ErrorState message={error} /> : salesBucketLabels.length === 0 ? <p className="text-xs text-macos-text-muted dark:text-zinc-400">No transaction data available for this period.</p> : (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block space-y-1.5"><span className="text-[10px] font-bold uppercase tracking-[0.18em] text-macos-text-muted dark:text-zinc-500">Timeline A</span><Select value={safeSelectionA} onChange={(event) => setSelectionA(event.target.value)}>{salesBucketLabels.map((option) => <option key={option} value={option}>{option}</option>)}</Select></label>
              <label className="block space-y-1.5"><span className="text-[10px] font-bold uppercase tracking-[0.18em] text-macos-text-muted dark:text-zinc-500">Timeline B</span><Select value={safeSelectionB} onChange={(event) => setSelectionB(event.target.value)}>{salesBucketLabels.map((option) => <option key={option} value={option}>{option}</option>)}</Select></label>
            </div>
            <InsightPanel state={salesInsight} onToggleAutoGenerate={() => setSalesInsight((prev) => ({ ...prev, autoGenerate: !prev.autoGenerate }))} onGenerate={generateSalesInsight} />
          </>
        )}
      </SectionCard>

      {salesBucketLabels.length > 0 && !isLoading && !error && (
        <SectionCard icon={BarChart3} title="Sales Comparison Chart" description="Revenue split between the selected timelines.">
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricTile label="Total A" value={money.format(totals.totalA)} />
            <MetricTile label="Total B" value={money.format(totals.totalB)} />
            <MetricTile label="Difference" value={money.format(totals.absoluteDiff)} tone={totals.absoluteDiff >= 0 ? 'green' : 'red'} />
            <MetricTile label="Growth" value={`${totals.growth.toFixed(1)}%`} tone={totals.growth >= 0 ? 'green' : 'red'} />
          </div>
          <div className="h-[340px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsLineChart data={comparisonData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(142,142,147,0.24)" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#86868B' }} />
                <YAxis tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#86868B' }} />
                <RechartsTooltip formatter={(value, name) => [money.format(Number(value ?? 0)), String(name)]} labelStyle={{ color: 'var(--app-text)', fontSize: 12 }} contentStyle={chartTooltipStyle} />
                <Legend />
                <Line type="monotone" dataKey="timelineA" name={safeSelectionA} stroke="#555558" strokeWidth={3} dot={{ r: 4 }} isAnimationActive={false} />
                <Line type="monotone" dataKey="timelineB" name={safeSelectionB} stroke="#AF52DE" strokeWidth={3} dot={{ r: 4 }} isAnimationActive={false} />
              </RechartsLineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
