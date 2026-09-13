import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
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

const money = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

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
          : `Performance may flatten if the same growth drivers are not sustained in the next period.`,
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
      riskWatchout:
        'Demand concentration on a small set of products can increase stockout risk and forecast volatility.',
      recommendedAction:
        `Increase buffer stock for ${leadingProduct} while testing demand lifts for lower-ranked products.`,
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
    <div className="mt-4 rounded border border-gray-200 p-3 dark:border-zinc-700">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={state.autoGenerate}
            onChange={onToggleAutoGenerate}
            className="h-4 w-4 rounded border-gray-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-600"
          />
          Auto-generate insights
        </label>
        <button
          type="button"
          onClick={onGenerate}
          disabled={state.isLoading}
          className="px-3 py-1.5 text-[10px] uppercase tracking-wide border rounded font-semibold bg-zinc-900 text-white border-zinc-900 disabled:opacity-60 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
        >
          {state.isLoading ? 'Generating...' : 'Generate Insights'}
        </button>
      </div>
      <p className="mt-2 text-[10px] uppercase tracking-wide text-gray-500 dark:text-zinc-400">
        Last generated: {formatInsightTime(state.lastGeneratedAt)}
      </p>

      {state.report ? (
        <div className="mt-3 space-y-2 text-xs text-gray-700 dark:text-zinc-300">
          <p>
            <span className="font-semibold text-gray-900 dark:text-zinc-100">Overview:</span> {state.report.overview}
          </p>
          <div>
            <p className="font-semibold text-gray-900 dark:text-zinc-100">Key Findings:</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              {state.report.keyFindings.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <p>
            <span className="font-semibold text-gray-900 dark:text-zinc-100">Risk / Watchout:</span>{' '}
            {state.report.riskWatchout}
          </p>
          <p>
            <span className="font-semibold text-gray-900 dark:text-zinc-100">Recommended Action:</span>{' '}
            {state.report.recommendedAction}
          </p>
          <p>
            <span className="font-semibold text-gray-900 dark:text-zinc-100">Confidence:</span>{' '}
            {Math.max(0, Math.min(100, state.report.confidence)).toFixed(1)}%
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-gray-500 dark:text-zinc-400">
          Generate insights to view a fixed mini-report.
        </p>
      )}
    </div>
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

  // Live summary
  const [liveSummary, setLiveSummary] = useState<AnalyticsSummary | null>(null);
  const [liveSummaryError, setLiveSummaryError] = useState<string | null>(null);
  const [isLiveSummaryLoading, setIsLiveSummaryLoading] = useState(true);

  // Sales timeline (for Comparative Sales + Profit Margin)
  const [salesTimeline, setSalesTimeline] = useState<SalesTimeline | null>(null);
  const [salesTimelineError, setSalesTimelineError] = useState<string | null>(null);
  const [isSalesTimelineLoading, setIsSalesTimelineLoading] = useState(true);

  // Product trends
  const [productTrends, setProductTrends] = useState<ProductTrends | null>(null);
  const [productTrendsError, setProductTrendsError] = useState<string | null>(null);
  const [isProductTrendsLoading, setIsProductTrendsLoading] = useState(true);

  // Inventory forecast
  const [inventoryForecast, setInventoryForecast] = useState<InventoryForecast | null>(null);
  const [inventoryForecastError, setInventoryForecastError] = useState<string | null>(null);
  const [isInventoryForecastLoading, setIsInventoryForecastLoading] = useState(true);

  // Compute date range (current year YTD)
  const dateRange = useMemo(() => {
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString().slice(0, 10);
    const to = now.toISOString().slice(0, 10);
    return { from, to };
  }, []);

  // --- Live summary effect ---
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

  // --- Sales timeline effect (re-fetches when salesPeriod changes) ---
  useEffect(() => {
    let mounted = true;
    setIsSalesTimelineLoading(true);
    const bucket = periodToBucket[salesPeriod];
    void analyticsApi.salesTimeline(dateRange.from, dateRange.to, bucket)
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

  // --- Product trends effect ---
  useEffect(() => {
    let mounted = true;
    setIsProductTrendsLoading(true);
    const bucket = periodToBucket[trendPeriod];
    void analyticsApi.productTrends(dateRange.from, dateRange.to, bucket)
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

  // --- Inventory forecast effect ---
  useEffect(() => {
    let mounted = true;
    setIsInventoryForecastLoading(true);
    const horizonDays = periodToHorizonDays[forecastPeriod];
    void analyticsApi.inventoryForecast(dateRange.from, dateRange.to, horizonDays)
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

  // --- Derived data: bucket labels (dropdown options) ---
  const salesBucketLabels = useMemo(() => {
    return salesTimeline?.buckets.map((b) => b.label) ?? [];
  }, [salesTimeline]);

  const trendBucketLabels = useMemo(() => {
    return productTrends?.buckets.map((b) => b.label) ?? [];
  }, [productTrends]);

  // --- Safe selections (fallback to first available bucket) ---
  const safeSelectionA = salesBucketLabels.includes(selectionA) ? selectionA : salesBucketLabels[0] ?? '';
  const safeSelectionB = salesBucketLabels.includes(selectionB)
    ? selectionB
    : salesBucketLabels[Math.min(1, salesBucketLabels.length - 1)] ?? '';
  const safeTrendSelection = trendBucketLabels.includes(trendSelection) ? trendSelection : trendBucketLabels[0] ?? '';

  // --- Comparative Sales Performance ---
  const comparisonData = useMemo(() => {
    if (!salesTimeline) return [];
    const bucketA = salesTimeline.buckets.find((b) => b.label === safeSelectionA);
    const bucketB = salesTimeline.buckets.find((b) => b.label === safeSelectionB);
    return [
      {
        label: safeSelectionA || 'A',
        timelineA: bucketA?.revenue ?? 0,
        timelineB: bucketB?.revenue ?? 0,
        delta: (bucketA?.revenue ?? 0) - (bucketB?.revenue ?? 0),
      },
    ];
  }, [salesTimeline, safeSelectionA, safeSelectionB]);

  const totals = useMemo(() => {
    const totalA = comparisonData.reduce((acc, item) => acc + item.timelineA, 0);
    const totalB = comparisonData.reduce((acc, item) => acc + item.timelineB, 0);
    const absoluteDiff = totalA - totalB;
    const growth = totalB === 0 ? 0 : (absoluteDiff / totalB) * 100;
    return { totalA, totalB, absoluteDiff, growth };
  }, [comparisonData]);

  // --- Profit Margin Analysis (uses all buckets from salesTimeline) ---
  const profitMarginData = useMemo(() => {
    if (!salesTimeline) return [];
    return salesTimeline.buckets.map((bucket) => {
      const profit = bucket.grossProfit;
      const margin = bucket.margin;
      return {
        label: bucket.label,
        revenue: bucket.revenue,
        expenses: bucket.cogs,
        profit,
        margin,
      };
    });
  }, [salesTimeline]);

  const profitMarginStats = useMemo(() => {
    const totalRevenue = profitMarginData.reduce((acc, item) => acc + item.revenue, 0);
    const totalExpenses = profitMarginData.reduce((acc, item) => acc + item.expenses, 0);
    const totalProfit = totalRevenue - totalExpenses;
    const averageMargin = totalRevenue === 0 ? 0 : (totalProfit / totalRevenue) * 100;
    const bestPoint = profitMarginData.reduce(
      (best, item) => (item.margin > best.margin ? item : best),
      profitMarginData[0] ?? { label: '-', margin: 0 },
    );
    const lowestPoint = profitMarginData.reduce(
      (lowest, item) => (item.margin < lowest.margin ? item : lowest),
      profitMarginData[0] ?? { label: '-', margin: 0 },
    );
    return { totalRevenue, totalExpenses, totalProfit, averageMargin, bestPoint, lowestPoint };
  }, [profitMarginData]);

  const sortedMarginRows = useMemo(() => {
    return [...profitMarginData].sort((a, b) => {
      if (marginSortOrder === 'desc') return b.margin - a.margin;
      return a.margin - b.margin;
    });
  }, [profitMarginData, marginSortOrder]);

  // --- Product Trend Identification ---
  const productTrendData = useMemo(() => {
    if (!productTrends) return [];
    const selected = productTrends.buckets.find((b) => b.label === safeTrendSelection);
    if (!selected) return [];
    return selected.items.map((item) => ({
      label: item.name,
      units: item.quantity,
      totalUnits: item.quantity,
    }));
  }, [productTrends, safeTrendSelection]);

  const productTrendSummary = useMemo(() => {
    const totalUnits = productTrendData.reduce((acc, item) => acc + item.units, 0);
    const ranked = [...productTrendData].sort((a, b) => b.units - a.units);
    const leadingProduct = ranked[0];
    const lowestProduct = ranked[ranked.length - 1];
    return { totalUnits, ranked, leadingProduct, lowestProduct };
  }, [productTrendData]);

  // --- Financial Forecasting (from inventory forecast data) ---
  const financialForecastChartData = useMemo(() => {
    if (!inventoryForecast) return [];
    const items = inventoryForecast.items.slice(0, 10);
    const presentCutoffIndex = Math.max(0, items.length - 2);
    return items.map((item, index) => {
      const actualValue = forecastMetric === 'income'
        ? item.avgDailyDemand * item.unitPrice * 30
        : item.avgDailyDemand * item.unitPrice * 0.63 * 30;
      const forecastValue = forecastMetric === 'income'
        ? item.forecastDemand * item.unitPrice
        : item.forecastDemand * item.unitPrice * 0.63;
      return {
        label: item.name,
        actualSeries: index <= presentCutoffIndex ? Math.round(actualValue) : null,
        forecastSeries:
          index < presentCutoffIndex
            ? null
            : index === presentCutoffIndex
              ? Math.round(actualValue)
              : Math.round(forecastValue),
      };
    });
  }, [inventoryForecast, forecastMetric]);

  const financialForecastStats = useMemo(() => {
    if (!inventoryForecast) {
      return { actual: 0, forecast: 0, lower: 0, upper: 0, expectedDelta: 0, expectedGrowth: 0, uncertaintyBand: 0, forecastAccuracyProxy: 0 };
    }
    const actual = forecastMetric === 'income'
      ? inventoryForecast.items.reduce((sum, i) => sum + i.avgDailyDemand * i.unitPrice * 30, 0)
      : inventoryForecast.items.reduce((sum, i) => sum + i.avgDailyDemand * i.unitPrice * 0.63 * 30, 0);
    const forecast = forecastMetric === 'income'
      ? inventoryForecast.projectedRevenue
      : inventoryForecast.projectedCogs;
    const lower = forecast * 0.92;
    const upper = forecast * 1.08;
    const expectedDelta = forecast - actual;
    const expectedGrowth = actual === 0 ? 0 : (expectedDelta / actual) * 100;
    const uncertaintyBand = upper - lower;
    const forecastAccuracyProxy = forecast === 0 ? 0 : 100 - (Math.abs(expectedDelta) / forecast) * 100;
    return { actual, forecast, lower, upper, expectedDelta, expectedGrowth, uncertaintyBand, forecastAccuracyProxy };
  }, [inventoryForecast, forecastMetric]);

  // --- Insight generators ---
  const generateSalesInsight = useCallback(async () => {
    setSalesInsight((prev) => ({ ...prev, isLoading: true }));
    const report = await generateInsight('sales', {
      growth: totals.growth,
      totalA: totals.totalA,
      totalB: totals.totalB,
      selectionA: safeSelectionA,
      selectionB: safeSelectionB,
    });
    setSalesInsight((prev) => ({
      ...prev,
      isLoading: false,
      report,
      lastGeneratedAt: new Date().toISOString(),
    }));
  }, [totals.growth, totals.totalA, totals.totalB, safeSelectionA, safeSelectionB]);

  const generateProfitInsight = useCallback(async () => {
    setProfitInsight((prev) => ({ ...prev, isLoading: true }));
    const report = await generateInsight('profit', {
      avgMargin: profitMarginStats.averageMargin,
      totalProfit: profitMarginStats.totalProfit,
      bestLabel: profitMarginStats.bestPoint.label,
      lowestLabel: profitMarginStats.lowestPoint.label,
    });
    setProfitInsight((prev) => ({
      ...prev,
      isLoading: false,
      report,
      lastGeneratedAt: new Date().toISOString(),
    }));
  }, [
    profitMarginStats.averageMargin,
    profitMarginStats.totalProfit,
    profitMarginStats.bestPoint.label,
    profitMarginStats.lowestPoint.label,
  ]);

  const generateTrendInsight = useCallback(async () => {
    setTrendInsight((prev) => ({ ...prev, isLoading: true }));
    const report = await generateInsight('trend', {
      totalUnits: productTrendSummary.totalUnits,
      leadingProduct: productTrendSummary.leadingProduct?.label ?? '-',
      leadingUnits: productTrendSummary.leadingProduct?.units ?? 0,
      lowestProduct: productTrendSummary.lowestProduct?.label ?? '-',
    });
    setTrendInsight((prev) => ({
      ...prev,
      isLoading: false,
      report,
      lastGeneratedAt: new Date().toISOString(),
    }));
  }, [
    productTrendSummary.totalUnits,
    productTrendSummary.leadingProduct?.label,
    productTrendSummary.leadingProduct?.units,
    productTrendSummary.lowestProduct?.label,
  ]);

  const generateForecastInsight = useCallback(async () => {
    setForecastInsight((prev) => ({ ...prev, isLoading: true }));
    const confidence = Math.max(0, Math.min(100, financialForecastStats.forecastAccuracyProxy));
    const report = await generateInsight('forecast', {
      metric: forecastMetric === 'income' ? 'Income' : 'Expenses',
      expectedGrowth: financialForecastStats.expectedGrowth,
      forecastConfidence: confidence,
      actual: financialForecastStats.actual,
      forecast: financialForecastStats.forecast,
    });
    setForecastInsight((prev) => ({
      ...prev,
      isLoading: false,
      report,
      lastGeneratedAt: new Date().toISOString(),
    }));
  }, [
    financialForecastStats.expectedGrowth,
    financialForecastStats.forecastAccuracyProxy,
    financialForecastStats.actual,
    financialForecastStats.forecast,
    forecastMetric,
  ]);

  useEffect(() => {
    if (!salesInsight.autoGenerate) return;
    void generateSalesInsight();
  }, [salesInsight.autoGenerate, generateSalesInsight]);

  useEffect(() => {
    if (!profitInsight.autoGenerate) return;
    void generateProfitInsight();
  }, [profitInsight.autoGenerate, generateProfitInsight]);

  useEffect(() => {
    if (!trendInsight.autoGenerate) return;
    void generateTrendInsight();
  }, [trendInsight.autoGenerate, generateTrendInsight]);

  useEffect(() => {
    if (!forecastInsight.autoGenerate) return;
    void generateForecastInsight();
  }, [forecastInsight.autoGenerate, generateForecastInsight]);

  // --- Period handlers ---
  const applyGlobalPeriod = (nextPeriod: Period) => {
    setGlobalPeriod(nextPeriod);
    setSalesPeriod(nextPeriod);
    setProfitPeriod(nextPeriod);
    setTrendPeriod(nextPeriod);
    setForecastPeriod(nextPeriod);
  };

  const handleSalesPeriodChange = (nextPeriod: Period) => {
    setSalesPeriod(nextPeriod);
    setProfitPeriod(nextPeriod);
  };

  const handleProfitPeriodChange = (nextPeriod: Period) => {
    setProfitPeriod(nextPeriod);
    setSalesPeriod(nextPeriod);
  };

  const handleTrendPeriodChange = (nextPeriod: Period) => {
    setTrendPeriod(nextPeriod);
  };

  const handleForecastPeriodChange = (nextPeriod: Period) => {
    setForecastPeriod(nextPeriod);
  };

  return (
    <div className="space-y-4 pb-8">
      {/* --- Live Summary --- */}
      <section className="bg-white border border-gray-200 rounded p-4 md:p-5 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-gray-500 dark:text-zinc-400">Live reporting</p>
            <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100">Operational summary</h2>
          </div>
          {liveSummary && <span className="text-[10px] font-mono text-gray-400">{liveSummary.range.from} to {liveSummary.range.to}</span>}
        </div>
        {isLiveSummaryLoading ? <LoadingState label="Loading report" /> : liveSummaryError ? <ErrorState message={liveSummaryError} /> : liveSummary ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                ['Revenue', money.format(liveSummary.revenue)],
                ['Transactions', liveSummary.transactionCount.toLocaleString()],
                ['Orders', liveSummary.orderCount.toLocaleString()],
                ['Avg ticket', money.format(liveSummary.averageTransactionValue)],
                ['Inventory alerts', liveSummary.inventoryAlerts.toLocaleString()],
              ].map(([label, value]) => (
                <div key={label} className="rounded border border-gray-200 p-3 dark:border-zinc-700">
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-zinc-400">{label}</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{value}</p>
                </div>
              ))}
            </div>
            {liveSummary.topItems.length > 0 && (
              <div className="mt-4 border-t border-gray-100 pt-3 dark:border-zinc-800">
                <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-zinc-400 mb-2">Top items by revenue</p>
                <div className="flex flex-wrap gap-2">
                  {liveSummary.topItems.slice(0, 5).map((item) => (
                    <span key={item.name} className="rounded border border-gray-200 px-2 py-1 text-[10px] text-gray-700 dark:border-zinc-700 dark:text-zinc-300">
                      {item.name} · {money.format(item.revenue)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </section>

      {/* --- Global Period Controller --- */}
      <section className="bg-white border border-gray-200 rounded p-4 md:p-5 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-gray-500 dark:text-zinc-400">
              Global Sort
            </p>
            <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100">
              Analytics Period Controller
            </h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Applies the selected period to all analytics sections.
            </p>
          </div>
          <div className="flex gap-2">
            {(['weekly', 'monthly', 'yearly'] as Period[]).map((item) => (
              <button
                key={`global-${item}`}
                type="button"
                onClick={() => applyGlobalPeriod(item)}
                className={`px-3 py-1.5 text-[10px] uppercase tracking-wide border rounded font-semibold ${
                  globalPeriod === item
                    ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
                    : 'bg-white text-gray-600 border-gray-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700'
                }`}
              >
                {periodLabel[item]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="space-y-4">
          {/* --- Comparative Sales Performance --- */}
          <section className="bg-white border border-gray-200 rounded p-4 md:p-5 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-gray-500 dark:text-zinc-400">
                  Analytics
                </p>
                <h2 className="text-base md:text-lg font-semibold text-gray-900 dark:text-zinc-100">
                  Comparative Sales Performance
                </h2>
                <p className="text-xs text-gray-500 mt-1 dark:text-zinc-400">
                  Compare two time periods by {periodLabel[salesPeriod].toLowerCase()} sales using real transaction data.
                </p>
              </div>
              <div className="flex gap-2">
                {(['weekly', 'monthly', 'yearly'] as Period[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleSalesPeriodChange(item)}
                    className={`px-3 py-1.5 text-[10px] uppercase tracking-wide border rounded font-semibold ${
                      salesPeriod === item
                        ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
                        : 'bg-white text-gray-600 border-gray-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700'
                    }`}
                  >
                    {periodLabel[item]}
                  </button>
                ))}
              </div>
            </div>

            {isSalesTimelineLoading ? (
              <div className="mt-4"><LoadingState label="Loading sales timeline" /></div>
            ) : salesTimelineError ? (
              <div className="mt-4"><ErrorState message={salesTimelineError} /></div>
            ) : salesBucketLabels.length === 0 ? (
              <p className="mt-4 text-xs text-gray-500 dark:text-zinc-400">No transaction data available for this period.</p>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-zinc-400">
                      Timeline A
                    </span>
                    <select
                      value={safeSelectionA}
                      onChange={(event) => setSelectionA(event.target.value)}
                      className="mt-1 w-full bg-white border border-gray-200 rounded px-3 py-2 text-xs text-gray-800 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-200"
                    >
                      {salesBucketLabels.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-zinc-400">
                      Timeline B
                    </span>
                    <select
                      value={safeSelectionB}
                      onChange={(event) => setSelectionB(event.target.value)}
                      className="mt-1 w-full bg-white border border-gray-200 rounded px-3 py-2 text-xs text-gray-800 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-200"
                    >
                      {salesBucketLabels.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <InsightPanel
                  state={salesInsight}
                  onToggleAutoGenerate={() =>
                    setSalesInsight((prev) => ({ ...prev, autoGenerate: !prev.autoGenerate }))
                  }
                  onGenerate={generateSalesInsight}
                />
              </>
            )}
          </section>

          {/* --- Comparison Stats + Chart --- */}
          {salesBucketLabels.length > 0 && !isSalesTimelineLoading && !salesTimelineError && (
            <section className="bg-white border border-gray-200 rounded p-4 md:p-5 dark:bg-zinc-900 dark:border-zinc-800">
              <div className="flex flex-wrap gap-4 text-xs text-gray-600 dark:text-zinc-300 mb-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-zinc-400">Total A</p>
                  <p className="font-semibold">{money.format(totals.totalA)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-zinc-400">Total B</p>
                  <p className="font-semibold">{money.format(totals.totalB)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-zinc-400">Difference</p>
                  <p className={`font-semibold ${totals.absoluteDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {money.format(totals.absoluteDiff)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-zinc-400">Growth</p>
                  <p className={`font-semibold ${totals.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {totals.growth.toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="h-[340px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={comparisonData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#E5E7EB" strokeDasharray="4 4" vertical={false} />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#6B7280' }}
                    />
                    <YAxis
                      tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#6B7280' }}
                    />
                    <Tooltip
                      formatter={(value, name) => [money.format(Number(value ?? 0)), String(name)]}
                      labelStyle={{ color: '#111827', fontSize: 12 }}
                      contentStyle={{
                        border: '1px solid #E5E7EB',
                        borderRadius: '6px',
                        boxShadow: 'none',
                        fontSize: '12px',
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="timelineA"
                      name={safeSelectionA}
                      stroke="#111827"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="timelineB"
                      name={safeSelectionB}
                      stroke="#9CA3AF"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}
        </div>

        {/* --- Profit Margin Analysis --- */}
        <section className="bg-white border border-gray-200 rounded p-4 md:p-5 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
                Profit Margin Analysis
              </h3>
              <p className="text-xs text-gray-500 mt-1 dark:text-zinc-400">
                Revenue vs COGS with margin trend across all {periodLabel[profitPeriod].toLowerCase()} buckets.
              </p>
            </div>
            <div className="flex gap-2">
              {(['weekly', 'monthly', 'yearly'] as Period[]).map((item) => (
                <button
                  key={`profit-${item}`}
                  type="button"
                  onClick={() => handleProfitPeriodChange(item)}
                  className={`px-3 py-1.5 text-[10px] uppercase tracking-wide border rounded font-semibold ${
                    profitPeriod === item
                      ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
                      : 'bg-white text-gray-600 border-gray-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700'
                  }`}
                >
                  {periodLabel[item]}
                </button>
              ))}
            </div>
          </div>

          {isSalesTimelineLoading ? (
            <LoadingState label="Loading profit data" />
          ) : salesTimelineError ? (
            <ErrorState message={salesTimelineError} />
          ) : profitMarginData.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-zinc-400">No transaction data available for this period.</p>
          ) : (
            <>
              <InsightPanel
                state={profitInsight}
                onToggleAutoGenerate={() =>
                  setProfitInsight((prev) => ({ ...prev, autoGenerate: !prev.autoGenerate }))
                }
                onGenerate={generateProfitInsight}
              />

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <div className="rounded border border-gray-200 p-3 dark:border-zinc-700">
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-zinc-400">Revenue</p>
                  <p className="text-xs font-semibold text-gray-900 dark:text-zinc-100">{money.format(profitMarginStats.totalRevenue)}</p>
                </div>
                <div className="rounded border border-gray-200 p-3 dark:border-zinc-700">
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-zinc-400">COGS</p>
                  <p className="text-xs font-semibold text-gray-900 dark:text-zinc-100">{money.format(profitMarginStats.totalExpenses)}</p>
                </div>
                <div className="rounded border border-gray-200 p-3 dark:border-zinc-700">
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-zinc-400">Gross Profit</p>
                  <p className="text-xs font-semibold text-green-600">{money.format(profitMarginStats.totalProfit)}</p>
                </div>
                <div className="rounded border border-gray-200 p-3 dark:border-zinc-700">
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-zinc-400">Avg Margin</p>
                  <p className="text-xs font-semibold text-gray-900 dark:text-zinc-100">{profitMarginStats.averageMargin.toFixed(1)}%</p>
                </div>
              </div>

              <div className="h-[360px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={profitMarginData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#E5E7EB" strokeDasharray="4 4" vertical={false} />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#6B7280' }}
                    />
                    <YAxis
                      yAxisId="amount"
                      tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#6B7280' }}
                    />
                    <YAxis
                      yAxisId="margin"
                      orientation="right"
                      tickFormatter={(value) => `${value.toFixed(0)}%`}
                      domain={[0, 50]}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#6B7280' }}
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        const numericValue = Number(value ?? 0);
                        const label = String(name);
                        if (label === 'Margin %') return [`${numericValue.toFixed(1)}%`, label];
                        return [money.format(numericValue), label];
                      }}
                      labelStyle={{ color: '#111827', fontSize: 12 }}
                      contentStyle={{
                        border: '1px solid #E5E7EB',
                        borderRadius: '6px',
                        boxShadow: 'none',
                        fontSize: '12px',
                      }}
                    />
                    <Legend />
                    <Bar
                      yAxisId="amount"
                      dataKey="revenue"
                      name="Revenue"
                      fill="#111827"
                      radius={[3, 3, 0, 0]}
                      isAnimationActive={false}
                    />
                    <Bar
                      yAxisId="amount"
                      dataKey="expenses"
                      name="COGS"
                      fill="#9CA3AF"
                      radius={[3, 3, 0, 0]}
                      isAnimationActive={false}
                    />
                    <Line
                      yAxisId="margin"
                      type="monotone"
                      dataKey="margin"
                      name="Margin %"
                      stroke="#16A34A"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 text-xs text-gray-600 dark:text-zinc-300 flex flex-wrap gap-4">
                <p>
                  <span className="font-semibold text-gray-900 dark:text-zinc-100">Best margin:</span>{' '}
                  {profitMarginStats.bestPoint.label} ({profitMarginStats.bestPoint.margin.toFixed(1)}%)
                </p>
                <p>
                  <span className="font-semibold text-gray-900 dark:text-zinc-100">Lowest margin:</span>{' '}
                  {profitMarginStats.lowestPoint.label} ({profitMarginStats.lowestPoint.margin.toFixed(1)}%)
                </p>
              </div>

              <div className="mt-4 border border-gray-200 rounded overflow-hidden dark:border-zinc-700">
                <div className="p-3 border-b border-gray-200 dark:border-zinc-700 flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-900 dark:text-zinc-100">Margin Ranking Table</p>
                  <label className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 dark:text-zinc-400">Sort</span>
                    <select
                      value={marginSortOrder}
                      onChange={(event) => setMarginSortOrder(event.target.value as 'desc' | 'asc')}
                      className="px-2 py-1 text-[10px] uppercase tracking-wide border border-gray-200 rounded font-semibold text-gray-700 dark:text-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-900"
                    >
                      <option value="desc">Highest to Lowest</option>
                      <option value="asc">Lowest to Highest</option>
                    </select>
                  </label>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-zinc-800/50">
                        <th className="px-3 py-2 font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Segment</th>
                        <th className="px-3 py-2 font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide text-right">Revenue</th>
                        <th className="px-3 py-2 font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide text-right">COGS</th>
                        <th className="px-3 py-2 font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide text-right">Profit</th>
                        <th className="px-3 py-2 font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide text-right">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedMarginRows.map((row) => (
                        <tr key={row.label} className="border-t border-gray-100 dark:border-zinc-800">
                          <td className="px-3 py-2 font-medium text-gray-800 dark:text-zinc-200">{row.label}</td>
                          <td className="px-3 py-2 text-right text-gray-700 dark:text-zinc-300">{money.format(row.revenue)}</td>
                          <td className="px-3 py-2 text-right text-gray-700 dark:text-zinc-300">{money.format(row.expenses)}</td>
                          <td className="px-3 py-2 text-right text-green-600">{money.format(row.profit)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-900 dark:text-zinc-100">{row.margin.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </section>

        {/* --- Product Trend Identification --- */}
        <section className="bg-white border border-gray-200 rounded p-4 md:p-5 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Product Trend Identification</h3>
              <p className="text-xs text-gray-500 mt-1 dark:text-zinc-400">
                Per-product demand by {periodLabel[trendPeriod].toLowerCase()} segment with total volume tracking.
              </p>
            </div>
            <div className="flex flex-col md:items-end gap-2 w-full md:w-auto">
              <div className="flex gap-2">
                {(['weekly', 'monthly', 'yearly'] as Period[]).map((item) => (
                  <button
                    key={`trend-${item}`}
                    type="button"
                    onClick={() => handleTrendPeriodChange(item)}
                    className={`px-3 py-1.5 text-[10px] uppercase tracking-wide border rounded font-semibold ${
                      trendPeriod === item
                        ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
                        : 'bg-white text-gray-600 border-gray-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700'
                    }`}
                  >
                    {periodLabel[item]}
                  </button>
                ))}
              </div>
              <label className="block w-full md:w-52">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-zinc-400">
                  Trend Range
                </span>
                <select
                  value={safeTrendSelection}
                  onChange={(event) => setTrendSelection(event.target.value)}
                  className="mt-1 w-full bg-white border border-gray-200 rounded px-3 py-2 text-xs text-gray-800 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-200"
                >
                  {trendBucketLabels.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {isProductTrendsLoading ? (
            <LoadingState label="Loading product trends" />
          ) : productTrendsError ? (
            <ErrorState message={productTrendsError} />
          ) : productTrendData.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-zinc-400">No product sales data available for this period.</p>
          ) : (
            <>
              <InsightPanel
                state={trendInsight}
                onToggleAutoGenerate={() =>
                  setTrendInsight((prev) => ({ ...prev, autoGenerate: !prev.autoGenerate }))
                }
                onGenerate={generateTrendInsight}
              />

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <div className="rounded border border-gray-200 p-3 dark:border-zinc-700">
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-zinc-400">Total Units</p>
                  <p className="text-xs font-semibold text-gray-900 dark:text-zinc-100">{productTrendSummary.totalUnits.toLocaleString()}</p>
                </div>
                <div className="rounded border border-gray-200 p-3 dark:border-zinc-700">
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-zinc-400">Leading Product</p>
                  <p className="text-xs font-semibold text-gray-900 dark:text-zinc-100">
                    {productTrendSummary.leadingProduct?.label ?? '-'} ({(productTrendSummary.leadingProduct?.units ?? 0).toLocaleString()})
                  </p>
                </div>
                <div className="rounded border border-gray-200 p-3 dark:border-zinc-700">
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-zinc-400">Lowest Product</p>
                  <p className="text-xs font-semibold text-gray-900 dark:text-zinc-100">
                    {productTrendSummary.lowestProduct?.label ?? '-'} ({(productTrendSummary.lowestProduct?.units ?? 0).toLocaleString()})
                  </p>
                </div>
                <div className="rounded border border-gray-200 p-3 dark:border-zinc-700">
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-zinc-400">Products</p>
                  <p className="text-xs font-semibold text-gray-900 dark:text-zinc-100">{productTrendData.length}</p>
                </div>
              </div>

              <div className="h-[380px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={productTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#E5E7EB" strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                    <YAxis yAxisId="units" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                    <YAxis
                      yAxisId="total"
                      orientation="right"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#6B7280' }}
                    />
                    <Tooltip
                      formatter={(value) => [Number(value ?? 0).toLocaleString(), 'Units']}
                      labelStyle={{ color: '#111827', fontSize: 12 }}
                      contentStyle={{ border: '1px solid #E5E7EB', borderRadius: '6px', boxShadow: 'none', fontSize: '12px' }}
                    />
                    <Legend />
                    <Bar yAxisId="units" dataKey="units" name="Units Sold" fill="#111827" isAnimationActive={false} />
                    <Line
                      yAxisId="total"
                      type="monotone"
                      dataKey="totalUnits"
                      name="Total Units"
                      stroke="#16A34A"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 border border-gray-200 rounded overflow-hidden dark:border-zinc-700">
                <div className="p-3 border-b border-gray-200 dark:border-zinc-700">
                  <p className="text-xs font-semibold text-gray-900 dark:text-zinc-100">Product Ranking (Current Selection)</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-zinc-800/50">
                        <th className="px-3 py-2 font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Rank</th>
                        <th className="px-3 py-2 font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Product</th>
                        <th className="px-3 py-2 font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide text-right">Units</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productTrendSummary.ranked.map((item, index) => (
                        <tr key={item.label} className="border-t border-gray-100 dark:border-zinc-800">
                          <td className="px-3 py-2 text-gray-700 dark:text-zinc-300">{index + 1}</td>
                          <td className="px-3 py-2 font-medium text-gray-800 dark:text-zinc-200">{item.label}</td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-900 dark:text-zinc-100">{item.units.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </section>

        {/* --- Financial Forecasting --- */}
        <section className="bg-white border border-gray-200 rounded p-4 md:p-5 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Financial Forecasting</h3>
              <p className="text-xs text-gray-500 mt-1 dark:text-zinc-400">
                Forecasted inventory requirements using moving-average demand projection with confidence bounds.
              </p>
            </div>
            <div className="flex flex-col md:items-end gap-2 w-full md:w-auto">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForecastMetric('income')}
                  className={`px-3 py-1.5 text-[10px] uppercase tracking-wide border rounded font-semibold ${
                    forecastMetric === 'income'
                      ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
                      : 'bg-white text-gray-600 border-gray-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700'
                  }`}
                >
                  Income
                </button>
                <button
                  type="button"
                  onClick={() => setForecastMetric('expenses')}
                  className={`px-3 py-1.5 text-[10px] uppercase tracking-wide border rounded font-semibold ${
                    forecastMetric === 'expenses'
                      ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
                      : 'bg-white text-gray-600 border-gray-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700'
                  }`}
                >
                  Expenses
                </button>
              </div>
              <div className="flex gap-2">
                {(['weekly', 'monthly', 'yearly'] as Period[]).map((item) => (
                  <button
                    key={`forecast-${item}`}
                    type="button"
                    onClick={() => handleForecastPeriodChange(item)}
                    className={`px-3 py-1.5 text-[10px] uppercase tracking-wide border rounded font-semibold ${
                      forecastPeriod === item
                        ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
                        : 'bg-white text-gray-600 border-gray-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700'
                    }`}
                  >
                    {periodLabel[item]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {isInventoryForecastLoading ? (
            <LoadingState label="Loading inventory forecast" />
          ) : inventoryForecastError ? (
            <ErrorState message={inventoryForecastError} />
          ) : !inventoryForecast || inventoryForecast.items.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-zinc-400">No inventory forecast data available for this period.</p>
          ) : (
            <>
              <InsightPanel
                state={forecastInsight}
                onToggleAutoGenerate={() =>
                  setForecastInsight((prev) => ({ ...prev, autoGenerate: !prev.autoGenerate }))
                }
                onGenerate={generateForecastInsight}
              />

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <div className="rounded border border-gray-200 p-3 dark:border-zinc-700">
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-zinc-400">
                    Actual {forecastMetric === 'income' ? 'Income' : 'Expenses'}
                  </p>
                  <p className="text-xs font-semibold text-gray-900 dark:text-zinc-100">{money.format(financialForecastStats.actual)}</p>
                </div>
                <div className="rounded border border-gray-200 p-3 dark:border-zinc-700">
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-zinc-400">
                    Forecast {forecastMetric === 'income' ? 'Income' : 'Expenses'}
                  </p>
                  <p className="text-xs font-semibold text-gray-900 dark:text-zinc-100">{money.format(financialForecastStats.forecast)}</p>
                </div>
                <div className="rounded border border-gray-200 p-3 dark:border-zinc-700">
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-zinc-400">Expected Growth</p>
                  <p className={`text-xs font-semibold ${financialForecastStats.expectedGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {financialForecastStats.expectedGrowth.toFixed(1)}%
                  </p>
                </div>
                <div className="rounded border border-gray-200 p-3 dark:border-zinc-700">
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-zinc-400">Forecast Confidence</p>
                  <p className="text-xs font-semibold text-gray-900 dark:text-zinc-100">
                    {Math.max(0, Math.min(100, financialForecastStats.forecastAccuracyProxy)).toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="h-[390px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={financialForecastChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#E5E7EB" strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                    <YAxis
                      yAxisId="amount"
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11, fill: '#6B7280' }}
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        return [money.format(Number(value ?? 0)), String(name)];
                      }}
                      labelStyle={{ color: '#111827', fontSize: 12 }}
                      contentStyle={{ border: '1px solid #E5E7EB', borderRadius: '6px', boxShadow: 'none', fontSize: '12px' }}
                    />
                    <Legend />
                    <Line
                      yAxisId="amount"
                      type="monotone"
                      dataKey="actualSeries"
                      name={`Actual ${forecastMetric === 'income' ? 'Income' : 'Expenses'}`}
                      stroke="#111827"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                    <Line
                      yAxisId="amount"
                      type="monotone"
                      dataKey="forecastSeries"
                      name={`Forecast ${forecastMetric === 'income' ? 'Income' : 'Expenses'}`}
                      stroke="#16A34A"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Inventory reorder recommendations table */}
              <div className="mt-4 border border-gray-200 rounded overflow-hidden dark:border-zinc-700">
                <div className="p-3 border-b border-gray-200 dark:border-zinc-700">
                  <p className="text-xs font-semibold text-gray-900 dark:text-zinc-100">
                    Inventory Reorder Recommendations ({inventoryForecast.horizonDays}-day horizon)
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-zinc-800/50">
                        <th className="px-3 py-2 font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Status</th>
                        <th className="px-3 py-2 font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Item</th>
                        <th className="px-3 py-2 font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide text-right">Stock</th>
                        <th className="px-3 py-2 font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide text-right">Reorder Lvl</th>
                        <th className="px-3 py-2 font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide text-right">Avg Daily</th>
                        <th className="px-3 py-2 font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide text-right">Forecast</th>
                        <th className="px-3 py-2 font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide text-right">Reorder Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryForecast.items.slice(0, 10).map((item) => (
                        <tr key={item.sku} className="border-t border-gray-100 dark:border-zinc-800">
                          <td className="px-3 py-2">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              item.status === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : item.status === 'warning' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-medium text-gray-800 dark:text-zinc-200">{item.name}</td>
                          <td className="px-3 py-2 text-right text-gray-700 dark:text-zinc-300">{item.currentStock.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right text-gray-700 dark:text-zinc-300">{item.reorderLevel.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right text-gray-700 dark:text-zinc-300">{item.avgDailyDemand.toFixed(1)}</td>
                          <td className="px-3 py-2 text-right text-gray-700 dark:text-zinc-300">{item.forecastDemand.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-900 dark:text-zinc-100">
                            {item.recommendedReorder > 0 ? item.recommendedReorder.toLocaleString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
