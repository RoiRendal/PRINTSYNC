import type { AnalyticsBucket } from '../api/analyticsApi';

export type Period = 'weekly' | 'monthly' | 'yearly';

export const periodToBucket: Record<Period, AnalyticsBucket> = {
  weekly: 'day',
  monthly: 'week',
  yearly: 'quarter',
};

export const periodToHorizonDays: Record<Period, number> = {
  weekly: 7,
  monthly: 30,
  yearly: 90,
};

export const periodLabel: Record<Period, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

export const periods: Period[] = ['weekly', 'monthly', 'yearly'];

export const money = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

export const chartTooltipStyle = {
  border: '1px solid rgba(255,255,255,0.45)',
  borderRadius: '14px',
  boxShadow: '0 18px 50px rgba(0,0,0,0.14)',
  fontSize: '12px',
  background: 'rgba(255,255,255,0.86)',
  backdropFilter: 'blur(20px)',
};

export type InsightFeature = 'sales' | 'profit' | 'trend' | 'forecast';

export type InsightReport = {
  overview: string;
  keyFindings: [string, string, string];
  riskWatchout: string;
  recommendedAction: string;
  confidence: number;
};

export type InsightState = {
  autoGenerate: boolean;
  isLoading: boolean;
  report: InsightReport | null;
  lastGeneratedAt: string | null;
};

export const createEmptyInsightState = (): InsightState => ({
  autoGenerate: false,
  isLoading: false,
  report: null,
  lastGeneratedAt: null,
});

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const formatInsightTime = (timestamp: string | null) => {
  if (!timestamp) return 'Not generated yet';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export async function generateInsight(
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
