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
import { TrendingUp } from 'lucide-react';
import type { ProductTrends } from '../api/analyticsApi';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import {
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
  periodLabel,
  type InsightState,
  type Period,
} from './analytics-types';
import { InsightPanel } from './InsightPanel';
import { MetricTile } from './MetricTile';
import { PeriodSelector } from './PeriodSelector';
import { SectionCard } from './SectionCard';

interface ProductTrendSectionProps {
  productTrends: ProductTrends | null;
  error: string | null;
  isLoading: boolean;
  trendPeriod: Period;
  onTrendPeriodChange: (period: Period) => void;
}

export function ProductTrendSection({
  productTrends,
  error,
  isLoading,
  trendPeriod,
  onTrendPeriodChange,
}: ProductTrendSectionProps) {
  const [trendSelection, setTrendSelection] = useState('');
  const [trendInsight, setTrendInsight] = useState<InsightState>(createEmptyInsightState());

  const trendBucketLabels = useMemo(() => productTrends?.buckets.map((b) => b.label) ?? [], [productTrends]);
  const safeTrendSelection = trendBucketLabels.includes(trendSelection) ? trendSelection : trendBucketLabels[0] ?? '';

  const productTrendData = useMemo(() => {
    if (!productTrends) return [];
    const selected = productTrends.buckets.find((b) => b.label === safeTrendSelection);
    if (!selected) return [];
    return selected.items.map((item) => ({ label: item.name, units: item.quantity, totalUnits: item.quantity }));
  }, [productTrends, safeTrendSelection]);

  const productTrendSummary = useMemo(() => {
    const totalUnits = productTrendData.reduce((acc, item) => acc + item.units, 0);
    const ranked = [...productTrendData].sort((a, b) => b.units - a.units);
    const leadingProduct = ranked[0];
    const lowestProduct = ranked[ranked.length - 1];
    return { totalUnits, ranked, leadingProduct, lowestProduct };
  }, [productTrendData]);

  const generateTrendInsight = useCallback(async () => {
    setTrendInsight((prev) => ({ ...prev, isLoading: true }));
    const report = await generateInsight('trend', { totalUnits: productTrendSummary.totalUnits, leadingProduct: productTrendSummary.leadingProduct?.label ?? '-', leadingUnits: productTrendSummary.leadingProduct?.units ?? 0, lowestProduct: productTrendSummary.lowestProduct?.label ?? '-' });
    setTrendInsight((prev) => ({ ...prev, isLoading: false, report, lastGeneratedAt: new Date().toISOString() }));
  }, [productTrendSummary.totalUnits, productTrendSummary.leadingProduct?.label, productTrendSummary.leadingProduct?.units, productTrendSummary.lowestProduct?.label]);

  useEffect(() => { if (trendInsight.autoGenerate) void generateTrendInsight(); }, [trendInsight.autoGenerate, generateTrendInsight]);

  return (
    <SectionCard
      icon={TrendingUp}
      title="Product Trend Identification"
      description={`Per-product demand by ${periodLabel[trendPeriod].toLowerCase()} segment with total volume tracking.`}
      controls={<div className="space-y-2"><PeriodSelector value={trendPeriod} onChange={onTrendPeriodChange} prefix="trend" />{trendBucketLabels.length > 0 && <Select fieldSize="sm" value={safeTrendSelection} onChange={(event) => setTrendSelection(event.target.value)}>{trendBucketLabels.map((option) => <option key={option} value={option}>{option}</option>)}</Select>}</div>}
    >
      {isLoading ? <LoadingState label="Loading product trends" /> : error ? <ErrorState message={error} /> : productTrendData.length === 0 ? <p className="text-xs text-macos-text-muted dark:text-zinc-400">No product sales data available for this period.</p> : (
        <>
          <InsightPanel state={trendInsight} onToggleAutoGenerate={() => setTrendInsight((prev) => ({ ...prev, autoGenerate: !prev.autoGenerate }))} onGenerate={generateTrendInsight} />
          <div className="my-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricTile label="Total Units" value={productTrendSummary.totalUnits.toLocaleString()} tone="blue" />
            <MetricTile label="Leading Product" value={`${productTrendSummary.leadingProduct?.label ?? '-'} (${(productTrendSummary.leadingProduct?.units ?? 0).toLocaleString()})`} tone="green" />
            <MetricTile label="Lowest Product" value={`${productTrendSummary.lowestProduct?.label ?? '-'} (${(productTrendSummary.lowestProduct?.units ?? 0).toLocaleString()})`} tone="orange" />
            <MetricTile label="Products" value={productTrendData.length.toLocaleString()} />
          </div>
          <div className="h-[380px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={productTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(142,142,147,0.24)" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#86868B' }} />
                <YAxis yAxisId="units" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#86868B' }} />
                <YAxis yAxisId="total" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#86868B' }} />
                <RechartsTooltip formatter={(value) => [Number(value ?? 0).toLocaleString(), 'Units']} labelStyle={{ color: 'var(--app-text)', fontSize: 12 }} contentStyle={chartTooltipStyle} />
                <Legend />
                <Bar yAxisId="units" dataKey="units" name="Units Sold" fill="#555558" radius={[8, 8, 0, 0]} animationDuration={700} />
                <Line yAxisId="total" type="monotone" dataKey="totalUnits" name="Total Units" stroke="#34C759" strokeWidth={3} dot={{ r: 4 }} animationDuration={700} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <TableContainer className="mt-4">
            <Table>
              <TableHeader><TableRow className="hover:bg-transparent"><TableHead>Rank</TableHead><TableHead>Product</TableHead><TableHead className="text-right">Units</TableHead></TableRow></TableHeader>
              <TableBody>{productTrendSummary.ranked.map((item, index) => <TableRow key={item.label}><TableCell>{index + 1}</TableCell><TableCell className="font-bold text-macos-text dark:text-zinc-100">{item.label}</TableCell><TableCell className="text-right font-bold text-macos-text dark:text-zinc-100">{item.units.toLocaleString()}</TableCell></TableRow>)}</TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </SectionCard>
  );
}
