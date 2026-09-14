import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, BarChart3, Brain, CalendarRange, LineChart as LineChartIcon, Sparkles, TrendingUp, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  analyticsApi,
  type AnalyticsBucket,
  type AnalyticsSummary,
  type InventoryForecast,
  type ProductTrends,
  type SalesTimeline,
} from '../api/analyticsApi';
import { ApiError } from '../../../shared/api/errors';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  GlassCard,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../shared/components/ui';
import { cn } from '../../../shared/lib/cn';

type Period = 'weekly' | 'monthly' | 'yearly';

const periodToBucket: Record<Period, AnalyticsBucket> = {
  weekly: 'day',
  monthly: 'week',
  yearly: 'quarter',
};

const periodToHorizonDays: Record<Period, number> = {
  weekly: 7,
  monthly: 30,
  yearly: 90,
};

const periodLabel: Record<Period, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

const periods: Period[] = ['weekly', 'monthly', 'yearly'];

const money = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

const chartTooltipStyle = {
  border: '1px solid rgba(255,255,255,0.45)',
  borderRadius: '14px',
  boxShadow: '0 18px 50px rgba(0,0,0,0.14)',
  fontSize: '12px',
  background: 'rgba(255,255,255,0.86)',
  backdropFilter: 'blur(20px)',
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const formatInsightTime = (timestamp: string | null) => {
  if (!timestamp) return 'Not generated yet';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

type InsightFeature = 'sales' | 'profit' | 'trend' | 'forecast';

type InsightReport = {
  overview: string;
  keyFindings: [string, string, string];
  riskWatchout: string;
  recommendedAction: string;
  confidence: number;
};

type InsightState = {
  autoGenerate: boolean;
  isLoading: boolean;
  report: InsightReport | null;
  lastGeneratedAt: string | null;
};

async function generateInsight(
  feature: InsightFeature,
  context: Record<string, number | string>,
): Promise<InsightReport> {
  await sleep(240);

  if (feature === 'sales') {
    const growth = Number(context.growth ?? 0);
    const totalA = Number(context.totalA ?? 0);
    const totalB = Number(context.totalB ?? 0);
    const selectionA = String(context.selectionA ?? 'Timeline A');
    const selectionB = String(context.selectionB ?? 'Timeline B');
    const trendWord = growth >= 0 ? 'higher' : 'lower';
    return {
      overview: `${selectionA} is ${Math.abs(growth).toFixed(1)}% ${trendWord} than ${selectionB} in the selected range.`,
      keyFindings: [
        `${selectionA} total sales: ${money.format(totalA)}.`,
        `${selectionB} total sales: ${money.format(totalB)}.`,
        `Absolute gap between both timelines: ${money.format(totalA - totalB)}.`,
      ],
      riskWatchout:
        growth < 0
          ? `Demand weakness in ${selectionA} may continue if campaign timing and product mix remain unchanged.`
          : 'Performance may flatten if the same growth drivers are not sustained in the next period.',
      recommendedAction:
        growth < 0
          ? `Prioritize underperforming segments in ${selectionA} and run targeted promotions for quick recovery.`
          : `Replicate the strongest drivers from ${selectionA} into weaker segments to preserve momentum.`,
      confidence: Math.max(72, Math.min(96, 88 + Math.min(8, Math.abs(growth) / 4))),
    };
  }

  if (feature === 'profit') {
    const avgMargin = Number(context.avgMargin ?? 0);
    const totalProfit = Number(context.totalProfit ?? 0);
    const bestLabel = String(context.bestLabel ?? '-');
    const lowestLabel = String(context.lowestLabel ?? '-');
    return {
      overview: `Average margin is ${avgMargin.toFixed(1)}% with a net profit of ${money.format(totalProfit)}.`,
      keyFindings: [
        `Best margin point: ${bestLabel}.`,
        `Lowest margin point: ${lowestLabel}.`,
        `Total net profit for this selection: ${money.format(totalProfit)}.`,
      ],
      riskWatchout:
        avgMargin < 30
          ? 'Margin compression risk is elevated due to expense pressure relative to revenue.'
          : 'Margins are healthy, but rising expenses can quickly reduce profitability if not monitored.',
      recommendedAction:
        avgMargin < 30
          ? 'Audit top expense categories and protect margin with pricing and procurement adjustments.'
          : 'Lock in high-margin product bundles and keep expense growth below revenue growth.',
      confidence: Math.max(74, Math.min(97, 85 + avgMargin / 6)),
    };
  }

  if (feature === 'trend') {
    const totalUnits = Number(context.totalUnits ?? 0);
    const leadingProduct = String(context.leadingProduct ?? '-');
    const leadingUnits = Number(context.leadingUnits ?? 0);
    const lowestProduct = String(context.lowestProduct ?? '-');
    return {
      overview: `${leadingProduct} leads demand with ${leadingUnits.toLocaleString()} units out of ${totalUnits.toLocaleString()} total units.`,
      keyFindings: [
        `Top product: ${leadingProduct} (${leadingUnits.toLocaleString()} units).`,
        `Lowest-ranked product: ${lowestProduct}.`,
        `Total demand volume in this selection: ${totalUnits.toLocaleString()} units.`,
      ],
      riskWatchout: 'Demand concentration on a small set of products can increase stockout risk and forecast volatility.',
      recommendedAction: `Increase buffer stock for ${leadingProduct} while testing demand lifts for lower-ranked products.`,
      confidence: Math.max(73, Math.min(95, 84 + (leadingUnits / Math.max(totalUnits, 1)) * 10)),
    };
  }

  const expectedGrowth = Number(context.expectedGrowth ?? 0);
  const forecastConfidence = Number(context.forecastConfidence ?? 0);
  const metric = String(context.metric ?? 'Income');
  return {
    overview: `${metric} is projected to move by ${expectedGrowth.toFixed(1)}% with a model confidence of ${forecastConfidence.toFixed(1)}%.`,
    keyFindings: [
      `Actual ${metric.toLowerCase()}: ${money.format(Number(context.actual ?? 0))}.`,
      `Forecast ${metric.toLowerCase()}: ${money.format(Number(context.forecast ?? 0))}.`,
      `Expected delta: ${money.format(Number(context.forecast ?? 0) - Number(context.actual ?? 0))}.`,
    ],
    riskWatchout:
      expectedGrowth < 0
        ? 'Downside trajectory can worsen if current demand softness persists.'
        : 'Forecast upside may be overstated if recent demand spikes normalize quickly.',
    recommendedAction:
      expectedGrowth < 0
        ? 'Prepare a conservative operating plan with tighter cost controls for near-term periods.'
        : 'Align capacity and staffing with the projected increase while tracking variance weekly.',
    confidence: Math.max(70, Math.min(98, forecastConfidence)),
  };
}

function PeriodSelector({ value, onChange, prefix }: { value: Period; onChange: (period: Period) => void; prefix: string }) {
  return (
    <div className="flex rounded-full border border-white/50 bg-white/55 p-1 shadow-[var(--shadow-card)] backdrop-blur-xl dark:border-white/10 dark:bg-white/8">
      {periods.map((item) => (
        <button
          key={`${prefix}-${item}`}
          type="button"
          onClick={() => onChange(item)}
          className={cn('h-8 cursor-pointer rounded-full px-3 text-[10px] font-bold uppercase tracking-[0.16em] transition-all', value === item ? 'bg-macos-blue text-white shadow-[0_6px_16px_rgb(0_122_255/0.22)]' : 'text-macos-text-muted hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10')}
        >
          {periodLabel[item]}
        </button>
      ))}
    </div>
  );
}

function MetricTile({ label, value, tone = 'neutral', icon: Icon }: { label: string; value: string; tone?: 'neutral' | 'blue' | 'green' | 'red' | 'orange' | 'purple'; icon?: LucideIcon }) {
  return (
    <GlassCard className="p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-macos-text-muted dark:text-zinc-500">{label}</p>
          <p className={cn('mt-1 font-mono text-sm font-bold text-macos-text dark:text-zinc-100', tone === 'blue' && 'text-macos-blue dark:text-macos-cyan', tone === 'green' && 'text-green-700 dark:text-green-300', tone === 'red' && 'text-red-700 dark:text-red-300', tone === 'orange' && 'text-orange-700 dark:text-orange-300', tone === 'purple' && 'text-purple-700 dark:text-purple-300')}>{value}</p>
        </div>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-macos-text-muted dark:text-zinc-500" aria-hidden="true" />}
      </div>
    </GlassCard>
  );
}

function SectionCard({ children, icon: Icon, title, description, controls }: { children: React.ReactNode; icon: LucideIcon; title: string; description: string; controls?: React.ReactNode }) {
  return (
    <Card variant="elevated" padding="lg" className="overflow-hidden">
      <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.95rem] bg-gradient-to-br from-macos-blue/18 to-white/40 text-macos-blue shadow-[var(--shadow-card)] ring-1 ring-macos-blue/20 dark:from-macos-blue-dark/20 dark:to-white/5 dark:text-macos-cyan">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
        {controls && <div className="shrink-0">{controls}</div>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function InsightPanel({
  state,
  onToggleAutoGenerate,
  onGenerate,
}: {
  state: InsightState;
  onToggleAutoGenerate: () => void;
  onGenerate: () => Promise<void>;
}) {
  return (
    <GlassCard className="mt-4 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onToggleAutoGenerate} className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-macos-text dark:text-zinc-200" aria-pressed={state.autoGenerate}>
          <span className={cn('relative h-5 w-9 rounded-full p-0.5 transition-colors', state.autoGenerate ? 'bg-macos-green' : 'bg-black/15 dark:bg-white/18')}>
            <span className={cn('block h-4 w-4 rounded-full bg-white shadow transition-transform', state.autoGenerate && 'translate-x-4')} />
          </span>
          Auto-generate insights
        </button>
        <Button type="button" size="sm" onClick={onGenerate} isLoading={state.isLoading} leftIcon={<Brain className="h-3.5 w-3.5" aria-hidden="true" />}>
          {state.isLoading ? 'Generating...' : 'Generate Insights'}
        </Button>
      </div>
      <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-macos-text-muted dark:text-zinc-500">Last generated: {formatInsightTime(state.lastGeneratedAt)}</p>

      {state.report ? (
        <div className="mt-4 space-y-3 text-xs leading-relaxed text-macos-text dark:text-zinc-300">
          <p><span className="font-bold text-macos-text dark:text-zinc-100">Overview:</span> {state.report.overview}</p>
          <div>
            <p className="font-bold text-macos-text dark:text-zinc-100">Key Findings:</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {state.report.keyFindings.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
          <p><span className="font-bold text-macos-text dark:text-zinc-100">Risk / Watchout:</span> {state.report.riskWatchout}</p>
          <p><span className="font-bold text-macos-text dark:text-zinc-100">Recommended Action:</span> {state.report.recommendedAction}</p>
          <Badge variant="blue">Confidence {Math.max(0, Math.min(100, state.report.confidence)).toFixed(1)}%</Badge>
        </div>
      ) : (
        <p className="mt-4 text-xs text-macos-text-muted dark:text-zinc-500">Generate insights to view a fixed mini-report.</p>
      )}
    </GlassCard>
  );
}

export default function AnalyticsPage() {
  const emptyInsightState: InsightState = {
    autoGenerate: false,
    isLoading: false,
    report: null,
    lastGeneratedAt: null,
  };

  const [globalPeriod, setGlobalPeriod] = useState<Period>('monthly');
  const [salesPeriod, setSalesPeriod] = useState<Period>('monthly');
  const [profitPeriod, setProfitPeriod] = useState<Period>('monthly');
  const [trendPeriod, setTrendPeriod] = useState<Period>('monthly');
  const [forecastPeriod, setForecastPeriod] = useState<Period>('monthly');
  const [selectionA, setSelectionA] = useState('');
  const [selectionB, setSelectionB] = useState('');
  const [marginSortOrder, setMarginSortOrder] = useState<'desc' | 'asc'>('desc');
  const [trendSelection, setTrendSelection] = useState('');
  const [forecastMetric, setForecastMetric] = useState<'income' | 'expenses'>('income');
  const [salesInsight, setSalesInsight] = useState<InsightState>(emptyInsightState);
  const [profitInsight, setProfitInsight] = useState<InsightState>(emptyInsightState);
  const [trendInsight, setTrendInsight] = useState<InsightState>(emptyInsightState);
  const [forecastInsight, setForecastInsight] = useState<InsightState>(emptyInsightState);

  const [liveSummary, setLiveSummary] = useState<AnalyticsSummary | null>(null);
  const [liveSummaryError, setLiveSummaryError] = useState<string | null>(null);
  const [isLiveSummaryLoading, setIsLiveSummaryLoading] = useState(true);
  const [salesTimeline, setSalesTimeline] = useState<SalesTimeline | null>(null);
  const [salesTimelineError, setSalesTimelineError] = useState<string | null>(null);
  const [isSalesTimelineLoading, setIsSalesTimelineLoading] = useState(true);
  const [productTrends, setProductTrends] = useState<ProductTrends | null>(null);
  const [productTrendsError, setProductTrendsError] = useState<string | null>(null);
  const [isProductTrendsLoading, setIsProductTrendsLoading] = useState(true);
  const [inventoryForecast, setInventoryForecast] = useState<InventoryForecast | null>(null);
  const [inventoryForecastError, setInventoryForecastError] = useState<string | null>(null);
  const [isInventoryForecastLoading, setIsInventoryForecastLoading] = useState(true);

  const dateRange = useMemo(() => {
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString().slice(0, 10);
    const to = now.toISOString().slice(0, 10);
    return { from, to };
  }, []);

  useEffect(() => {
    let mounted = true;
    void analyticsApi.summary(dateRange.from, dateRange.to)
      .then((summary) => {
        if (mounted) {
          setLiveSummary(summary);
          setLiveSummaryError(null);
        }
      })
      .catch((error: unknown) => {
        if (mounted) setLiveSummaryError(error instanceof ApiError ? error.message : 'Analytics could not be loaded.');
      })
      .finally(() => {
        if (mounted) setIsLiveSummaryLoading(false);
      });
    return () => { mounted = false; };
  }, [dateRange.from, dateRange.to]);

  useEffect(() => {
    let mounted = true;
    setIsSalesTimelineLoading(true);
    void analyticsApi.salesTimeline(dateRange.from, dateRange.to, periodToBucket[salesPeriod])
      .then((data) => {
        if (mounted) {
          setSalesTimeline(data);
          setSalesTimelineError(null);
        }
      })
      .catch((error: unknown) => {
        if (mounted) setSalesTimelineError(error instanceof ApiError ? error.message : 'Sales timeline could not be loaded.');
      })
      .finally(() => {
        if (mounted) setIsSalesTimelineLoading(false);
      });
    return () => { mounted = false; };
  }, [dateRange.from, dateRange.to, salesPeriod]);

  useEffect(() => {
    let mounted = true;
    setIsProductTrendsLoading(true);
    void analyticsApi.productTrends(dateRange.from, dateRange.to, periodToBucket[trendPeriod])
      .then((data) => {
        if (mounted) {
          setProductTrends(data);
          setProductTrendsError(null);
        }
      })
      .catch((error: unknown) => {
        if (mounted) setProductTrendsError(error instanceof ApiError ? error.message : 'Product trends could not be loaded.');
      })
      .finally(() => {
        if (mounted) setIsProductTrendsLoading(false);
      });
    return () => { mounted = false; };
  }, [dateRange.from, dateRange.to, trendPeriod]);

  useEffect(() => {
    let mounted = true;
    setIsInventoryForecastLoading(true);
    void analyticsApi.inventoryForecast(dateRange.from, dateRange.to, periodToHorizonDays[forecastPeriod])
      .then((data) => {
        if (mounted) {
          setInventoryForecast(data);
          setInventoryForecastError(null);
        }
      })
      .catch((error: unknown) => {
        if (mounted) setInventoryForecastError(error instanceof ApiError ? error.message : 'Inventory forecast could not be loaded.');
      })
      .finally(() => {
        if (mounted) setIsInventoryForecastLoading(false);
      });
    return () => { mounted = false; };
  }, [dateRange.from, dateRange.to, forecastPeriod]);

  const salesBucketLabels = useMemo(() => salesTimeline?.buckets.map((b) => b.label) ?? [], [salesTimeline]);
  const trendBucketLabels = useMemo(() => productTrends?.buckets.map((b) => b.label) ?? [], [productTrends]);
  const safeSelectionA = salesBucketLabels.includes(selectionA) ? selectionA : salesBucketLabels[0] ?? '';
  const safeSelectionB = salesBucketLabels.includes(selectionB) ? selectionB : salesBucketLabels[Math.min(1, salesBucketLabels.length - 1)] ?? '';
  const safeTrendSelection = trendBucketLabels.includes(trendSelection) ? trendSelection : trendBucketLabels[0] ?? '';

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

  const profitMarginData = useMemo(() => {
    if (!salesTimeline) return [];
    return salesTimeline.buckets.map((bucket) => ({ label: bucket.label, revenue: bucket.revenue, expenses: bucket.cogs, profit: bucket.grossProfit, margin: bucket.margin }));
  }, [salesTimeline]);

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

  const financialForecastChartData = useMemo(() => {
    if (!inventoryForecast) return [];
    const items = inventoryForecast.items.slice(0, 10);
    const presentCutoffIndex = Math.max(0, items.length - 2);
    return items.map((item, index) => {
      const actualValue = forecastMetric === 'income' ? item.avgDailyDemand * item.unitPrice * 30 : item.avgDailyDemand * item.unitPrice * 0.63 * 30;
      const forecastValue = forecastMetric === 'income' ? item.forecastDemand * item.unitPrice : item.forecastDemand * item.unitPrice * 0.63;
      return {
        label: item.name,
        actualSeries: index <= presentCutoffIndex ? Math.round(actualValue) : null,
        forecastSeries: index < presentCutoffIndex ? null : index === presentCutoffIndex ? Math.round(actualValue) : Math.round(forecastValue),
      };
    });
  }, [inventoryForecast, forecastMetric]);

  const financialForecastStats = useMemo(() => {
    if (!inventoryForecast) return { actual: 0, forecast: 0, lower: 0, upper: 0, expectedDelta: 0, expectedGrowth: 0, uncertaintyBand: 0, forecastAccuracyProxy: 0 };
    const actual = forecastMetric === 'income'
      ? inventoryForecast.items.reduce((sum, i) => sum + i.avgDailyDemand * i.unitPrice * 30, 0)
      : inventoryForecast.items.reduce((sum, i) => sum + i.avgDailyDemand * i.unitPrice * 0.63 * 30, 0);
    const forecast = forecastMetric === 'income' ? inventoryForecast.projectedRevenue : inventoryForecast.projectedCogs;
    const lower = forecast * 0.92;
    const upper = forecast * 1.08;
    const expectedDelta = forecast - actual;
    const expectedGrowth = actual === 0 ? 0 : (expectedDelta / actual) * 100;
    const uncertaintyBand = upper - lower;
    const forecastAccuracyProxy = forecast === 0 ? 0 : 100 - (Math.abs(expectedDelta) / forecast) * 100;
    return { actual, forecast, lower, upper, expectedDelta, expectedGrowth, uncertaintyBand, forecastAccuracyProxy };
  }, [inventoryForecast, forecastMetric]);

  const generateSalesInsight = useCallback(async () => {
    setSalesInsight((prev) => ({ ...prev, isLoading: true }));
    const report = await generateInsight('sales', { growth: totals.growth, totalA: totals.totalA, totalB: totals.totalB, selectionA: safeSelectionA, selectionB: safeSelectionB });
    setSalesInsight((prev) => ({ ...prev, isLoading: false, report, lastGeneratedAt: new Date().toISOString() }));
  }, [totals.growth, totals.totalA, totals.totalB, safeSelectionA, safeSelectionB]);

  const generateProfitInsight = useCallback(async () => {
    setProfitInsight((prev) => ({ ...prev, isLoading: true }));
    const report = await generateInsight('profit', { avgMargin: profitMarginStats.averageMargin, totalProfit: profitMarginStats.totalProfit, bestLabel: profitMarginStats.bestPoint.label, lowestLabel: profitMarginStats.lowestPoint.label });
    setProfitInsight((prev) => ({ ...prev, isLoading: false, report, lastGeneratedAt: new Date().toISOString() }));
  }, [profitMarginStats.averageMargin, profitMarginStats.totalProfit, profitMarginStats.bestPoint.label, profitMarginStats.lowestPoint.label]);

  const generateTrendInsight = useCallback(async () => {
    setTrendInsight((prev) => ({ ...prev, isLoading: true }));
    const report = await generateInsight('trend', { totalUnits: productTrendSummary.totalUnits, leadingProduct: productTrendSummary.leadingProduct?.label ?? '-', leadingUnits: productTrendSummary.leadingProduct?.units ?? 0, lowestProduct: productTrendSummary.lowestProduct?.label ?? '-' });
    setTrendInsight((prev) => ({ ...prev, isLoading: false, report, lastGeneratedAt: new Date().toISOString() }));
  }, [productTrendSummary.totalUnits, productTrendSummary.leadingProduct?.label, productTrendSummary.leadingProduct?.units, productTrendSummary.lowestProduct?.label]);

  const generateForecastInsight = useCallback(async () => {
    setForecastInsight((prev) => ({ ...prev, isLoading: true }));
    const confidence = Math.max(0, Math.min(100, financialForecastStats.forecastAccuracyProxy));
    const report = await generateInsight('forecast', { metric: forecastMetric === 'income' ? 'Income' : 'Expenses', expectedGrowth: financialForecastStats.expectedGrowth, forecastConfidence: confidence, actual: financialForecastStats.actual, forecast: financialForecastStats.forecast });
    setForecastInsight((prev) => ({ ...prev, isLoading: false, report, lastGeneratedAt: new Date().toISOString() }));
  }, [financialForecastStats.expectedGrowth, financialForecastStats.forecastAccuracyProxy, financialForecastStats.actual, financialForecastStats.forecast, forecastMetric]);

  useEffect(() => { if (salesInsight.autoGenerate) void generateSalesInsight(); }, [salesInsight.autoGenerate, generateSalesInsight]);
  useEffect(() => { if (profitInsight.autoGenerate) void generateProfitInsight(); }, [profitInsight.autoGenerate, generateProfitInsight]);
  useEffect(() => { if (trendInsight.autoGenerate) void generateTrendInsight(); }, [trendInsight.autoGenerate, generateTrendInsight]);
  useEffect(() => { if (forecastInsight.autoGenerate) void generateForecastInsight(); }, [forecastInsight.autoGenerate, generateForecastInsight]);

  const applyGlobalPeriod = (nextPeriod: Period) => {
    setGlobalPeriod(nextPeriod);
    setSalesPeriod(nextPeriod);
    setProfitPeriod(nextPeriod);
    setTrendPeriod(nextPeriod);
    setForecastPeriod(nextPeriod);
  };

  const handleSalesPeriodChange = (nextPeriod: Period) => { setSalesPeriod(nextPeriod); setProfitPeriod(nextPeriod); };
  const handleProfitPeriodChange = (nextPeriod: Period) => { setProfitPeriod(nextPeriod); setSalesPeriod(nextPeriod); };
  const handleTrendPeriodChange = (nextPeriod: Period) => setTrendPeriod(nextPeriod);
  const handleForecastPeriodChange = (nextPeriod: Period) => setForecastPeriod(nextPeriod);

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/55 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-macos-blue shadow-[var(--shadow-card)] backdrop-blur-xl dark:border-white/10 dark:bg-white/8 dark:text-macos-cyan">
            <Sparkles className="h-3 w-3" aria-hidden="true" /> Intelligence Studio
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-macos-text dark:text-zinc-100 lg:text-[28px]">Analytics</h1>
          <p className="mt-1 text-sm text-macos-text-muted dark:text-zinc-400">Live performance, margin telemetry, demand ranking, and forecasting in one glass dashboard.</p>
        </div>
        <GlassCard className="flex flex-col gap-2 p-3 md:flex-row md:items-center">
          <div className="flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-macos-text-muted dark:text-zinc-500"><CalendarRange className="h-3.5 w-3.5" aria-hidden="true" /> Global Sort</div>
          <PeriodSelector value={globalPeriod} onChange={applyGlobalPeriod} prefix="global" />
        </GlassCard>
      </div>

      <SectionCard icon={Activity} title="Operational Summary" description="Live reporting snapshot from current year-to-date data." controls={liveSummary && <Badge variant="blue">{liveSummary.range.from} → {liveSummary.range.to}</Badge>}>
        {isLiveSummaryLoading ? <LoadingState label="Loading report" /> : liveSummaryError ? <ErrorState message={liveSummaryError} /> : liveSummary ? (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <MetricTile label="Revenue" value={money.format(liveSummary.revenue)} tone="blue" icon={Wallet} />
              <MetricTile label="Transactions" value={liveSummary.transactionCount.toLocaleString()} icon={Activity} />
              <MetricTile label="Orders" value={liveSummary.orderCount.toLocaleString()} tone="purple" icon={BarChart3} />
              <MetricTile label="Avg ticket" value={money.format(liveSummary.averageTransactionValue)} tone="green" icon={TrendingUp} />
              <MetricTile label="Inventory alerts" value={liveSummary.inventoryAlerts.toLocaleString()} tone={liveSummary.inventoryAlerts > 0 ? 'orange' : 'neutral'} icon={LineChartIcon} />
            </div>
            {liveSummary.topItems.length > 0 && (
              <div className="mt-4 border-t border-black/5 pt-3 dark:border-white/10">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-macos-text-muted dark:text-zinc-500">Top items by revenue</p>
                <div className="flex flex-wrap gap-2">
                  {liveSummary.topItems.slice(0, 5).map((item) => <Badge key={item.name} variant="gray">{item.name} · {money.format(item.revenue)}</Badge>)}
                </div>
              </div>
            )}
          </>
        ) : null}
      </SectionCard>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="space-y-5">
          <SectionCard icon={LineChartIcon} title="Comparative Sales Performance" description={`Compare two time periods by ${periodLabel[salesPeriod].toLowerCase()} sales using real transaction data.`} controls={<PeriodSelector value={salesPeriod} onChange={handleSalesPeriodChange} prefix="sales" />}>
            {isSalesTimelineLoading ? <LoadingState label="Loading sales timeline" /> : salesTimelineError ? <ErrorState message={salesTimelineError} /> : salesBucketLabels.length === 0 ? <p className="text-xs text-macos-text-muted dark:text-zinc-400">No transaction data available for this period.</p> : (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block space-y-1.5"><span className="text-[10px] font-bold uppercase tracking-[0.18em] text-macos-text-muted dark:text-zinc-500">Timeline A</span><Select value={safeSelectionA} onChange={(event) => setSelectionA(event.target.value)}>{salesBucketLabels.map((option) => <option key={option} value={option}>{option}</option>)}</Select></label>
                  <label className="block space-y-1.5"><span className="text-[10px] font-bold uppercase tracking-[0.18em] text-macos-text-muted dark:text-zinc-500">Timeline B</span><Select value={safeSelectionB} onChange={(event) => setSelectionB(event.target.value)}>{salesBucketLabels.map((option) => <option key={option} value={option}>{option}</option>)}</Select></label>
                </div>
                <InsightPanel state={salesInsight} onToggleAutoGenerate={() => setSalesInsight((prev) => ({ ...prev, autoGenerate: !prev.autoGenerate }))} onGenerate={generateSalesInsight} />
              </>
            )}
          </SectionCard>

          {salesBucketLabels.length > 0 && !isSalesTimelineLoading && !salesTimelineError && (
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
                    <RechartsTooltip formatter={(value, name) => [money.format(Number(value ?? 0)), String(name)]} labelStyle={{ color: '#1D1D1F', fontSize: 12 }} contentStyle={chartTooltipStyle} />
                    <Legend />
                    <Line type="monotone" dataKey="timelineA" name={safeSelectionA} stroke="#007AFF" strokeWidth={3} dot={{ r: 4 }} animationDuration={700} />
                    <Line type="monotone" dataKey="timelineB" name={safeSelectionB} stroke="#AF52DE" strokeWidth={3} dot={{ r: 4 }} animationDuration={700} />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          )}
        </div>

        <SectionCard icon={Wallet} title="Profit Margin Analysis" description={`Revenue vs COGS with margin trend across all ${periodLabel[profitPeriod].toLowerCase()} buckets.`} controls={<PeriodSelector value={profitPeriod} onChange={handleProfitPeriodChange} prefix="profit" />}>
          {isSalesTimelineLoading ? <LoadingState label="Loading profit data" /> : salesTimelineError ? <ErrorState message={salesTimelineError} /> : profitMarginData.length === 0 ? <p className="text-xs text-macos-text-muted dark:text-zinc-400">No transaction data available for this period.</p> : (
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
                    <Bar yAxisId="amount" dataKey="revenue" name="Revenue" fill="#007AFF" radius={[8, 8, 0, 0]} animationDuration={700} />
                    <Bar yAxisId="amount" dataKey="expenses" name="COGS" fill="#AF52DE" radius={[8, 8, 0, 0]} animationDuration={700} />
                    <Line yAxisId="margin" type="monotone" dataKey="margin" name="Margin %" stroke="#34C759" strokeWidth={3} dot={{ r: 4 }} animationDuration={700} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-macos-text-muted dark:text-zinc-400">
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

        <SectionCard icon={TrendingUp} title="Product Trend Identification" description={`Per-product demand by ${periodLabel[trendPeriod].toLowerCase()} segment with total volume tracking.`} controls={<div className="space-y-2"><PeriodSelector value={trendPeriod} onChange={handleTrendPeriodChange} prefix="trend" />{trendBucketLabels.length > 0 && <Select fieldSize="sm" value={safeTrendSelection} onChange={(event) => setTrendSelection(event.target.value)}>{trendBucketLabels.map((option) => <option key={option} value={option}>{option}</option>)}</Select>}</div>}>
          {isProductTrendsLoading ? <LoadingState label="Loading product trends" /> : productTrendsError ? <ErrorState message={productTrendsError} /> : productTrendData.length === 0 ? <p className="text-xs text-macos-text-muted dark:text-zinc-400">No product sales data available for this period.</p> : (
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
                    <RechartsTooltip formatter={(value) => [Number(value ?? 0).toLocaleString(), 'Units']} labelStyle={{ color: '#1D1D1F', fontSize: 12 }} contentStyle={chartTooltipStyle} />
                    <Legend />
                    <Bar yAxisId="units" dataKey="units" name="Units Sold" fill="#007AFF" radius={[8, 8, 0, 0]} animationDuration={700} />
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

        <SectionCard icon={Brain} title="Financial Forecasting" description="Forecasted inventory requirements using moving-average demand projection with confidence bounds." controls={<div className="space-y-2"><div className="flex rounded-full border border-white/50 bg-white/55 p-1 shadow-[var(--shadow-card)] backdrop-blur-xl dark:border-white/10 dark:bg-white/8"><button type="button" onClick={() => setForecastMetric('income')} className={cn('h-8 cursor-pointer rounded-full px-3 text-[10px] font-bold uppercase tracking-[0.16em] transition-all', forecastMetric === 'income' ? 'bg-macos-green text-white shadow-[0_6px_16px_rgb(52_199_89/0.22)]' : 'text-macos-text-muted hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10')}>Income</button><button type="button" onClick={() => setForecastMetric('expenses')} className={cn('h-8 cursor-pointer rounded-full px-3 text-[10px] font-bold uppercase tracking-[0.16em] transition-all', forecastMetric === 'expenses' ? 'bg-macos-orange text-white shadow-[0_6px_16px_rgb(255_149_0/0.22)]' : 'text-macos-text-muted hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10')}>Expenses</button></div><PeriodSelector value={forecastPeriod} onChange={handleForecastPeriodChange} prefix="forecast" /></div>}>
          {isInventoryForecastLoading ? <LoadingState label="Loading inventory forecast" /> : inventoryForecastError ? <ErrorState message={inventoryForecastError} /> : !inventoryForecast || inventoryForecast.items.length === 0 ? <p className="text-xs text-macos-text-muted dark:text-zinc-400">No inventory forecast data available for this period.</p> : (
            <>
              <InsightPanel state={forecastInsight} onToggleAutoGenerate={() => setForecastInsight((prev) => ({ ...prev, autoGenerate: !prev.autoGenerate }))} onGenerate={generateForecastInsight} />
              <div className="my-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MetricTile label={`Actual ${forecastMetric === 'income' ? 'Income' : 'Expenses'}`} value={money.format(financialForecastStats.actual)} />
                <MetricTile label={`Forecast ${forecastMetric === 'income' ? 'Income' : 'Expenses'}`} value={money.format(financialForecastStats.forecast)} tone="blue" />
                <MetricTile label="Expected Growth" value={`${financialForecastStats.expectedGrowth.toFixed(1)}%`} tone={financialForecastStats.expectedGrowth >= 0 ? 'green' : 'red'} />
                <MetricTile label="Forecast Confidence" value={`${Math.max(0, Math.min(100, financialForecastStats.forecastAccuracyProxy)).toFixed(1)}%`} tone="purple" />
              </div>
              <div className="h-[390px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={financialForecastChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(142,142,147,0.24)" strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#86868B' }} />
                    <YAxis yAxisId="amount" axisLine={false} tickLine={false} tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#86868B' }} />
                    <RechartsTooltip formatter={(value, name) => [money.format(Number(value ?? 0)), String(name)]} labelStyle={{ color: '#1D1D1F', fontSize: 12 }} contentStyle={chartTooltipStyle} />
                    <Legend />
                    <Line yAxisId="amount" type="monotone" dataKey="actualSeries" name={`Actual ${forecastMetric === 'income' ? 'Income' : 'Expenses'}`} stroke="#007AFF" strokeWidth={3} dot={{ r: 4 }} connectNulls={false} animationDuration={700} />
                    <Line yAxisId="amount" type="monotone" dataKey="forecastSeries" name={`Forecast ${forecastMetric === 'income' ? 'Income' : 'Expenses'}`} stroke="#34C759" strokeWidth={3} dot={{ r: 4 }} connectNulls={false} animationDuration={700} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <TableContainer className="mt-4">
                <div className="border-b border-black/5 p-3 dark:border-white/10"><p className="text-xs font-bold text-macos-text dark:text-zinc-100">Inventory Reorder Recommendations ({inventoryForecast.horizonDays}-day horizon)</p></div>
                <Table>
                  <TableHeader><TableRow className="hover:bg-transparent"><TableHead>Status</TableHead><TableHead>Item</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Reorder Lvl</TableHead><TableHead className="text-right">Avg Daily</TableHead><TableHead className="text-right">Forecast</TableHead><TableHead className="text-right">Reorder Qty</TableHead></TableRow></TableHeader>
                  <TableBody>{inventoryForecast.items.slice(0, 10).map((item) => <TableRow key={item.sku}><TableCell><Badge variant={item.status === 'critical' ? 'red' : item.status === 'warning' ? 'orange' : 'green'}>{item.status}</Badge></TableCell><TableCell className="font-bold text-macos-text dark:text-zinc-100">{item.name}</TableCell><TableCell className="text-right">{item.currentStock.toLocaleString()}</TableCell><TableCell className="text-right">{item.reorderLevel.toLocaleString()}</TableCell><TableCell className="text-right">{item.avgDailyDemand.toFixed(1)}</TableCell><TableCell className="text-right">{item.forecastDemand.toLocaleString()}</TableCell><TableCell className="text-right font-bold text-macos-text dark:text-zinc-100">{item.recommendedReorder > 0 ? item.recommendedReorder.toLocaleString() : '—'}</TableCell></TableRow>)}</TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
