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

type Period = 'weekly' | 'monthly' | 'yearly';

type DataPoint = {
  label: string;
  sales: number;
};

type TimelineData = Record<string, DataPoint[]>;

const weeklyData: TimelineData = {
  'Week 1': [
    { label: 'Mon', sales: 9000 },
    { label: 'Tue', sales: 11200 },
    { label: 'Wed', sales: 10400 },
    { label: 'Thu', sales: 12800 },
    { label: 'Fri', sales: 14900 },
    { label: 'Sat', sales: 16500 },
    { label: 'Sun', sales: 12100 },
  ],
  'Week 2': [
    { label: 'Mon', sales: 9400 },
    { label: 'Tue', sales: 10800 },
    { label: 'Wed', sales: 11800 },
    { label: 'Thu', sales: 13200 },
    { label: 'Fri', sales: 15600 },
    { label: 'Sat', sales: 17100 },
    { label: 'Sun', sales: 12900 },
  ],
  'Week 3': [
    { label: 'Mon', sales: 8600 },
    { label: 'Tue', sales: 9700 },
    { label: 'Wed', sales: 11000 },
    { label: 'Thu', sales: 12100 },
    { label: 'Fri', sales: 13800 },
    { label: 'Sat', sales: 15900 },
    { label: 'Sun', sales: 11600 },
  ],
  'Week 4': [
    { label: 'Mon', sales: 10100 },
    { label: 'Tue', sales: 11700 },
    { label: 'Wed', sales: 12600 },
    { label: 'Thu', sales: 13400 },
    { label: 'Fri', sales: 16400 },
    { label: 'Sat', sales: 17900 },
    { label: 'Sun', sales: 13600 },
  ],
};

const monthlyData: TimelineData = {
  January: [
    { label: 'Week 1', sales: 68000 },
    { label: 'Week 2', sales: 72000 },
    { label: 'Week 3', sales: 70500 },
    { label: 'Week 4', sales: 76000 },
  ],
  February: [
    { label: 'Week 1', sales: 65000 },
    { label: 'Week 2', sales: 69400 },
    { label: 'Week 3', sales: 71000 },
    { label: 'Week 4', sales: 74800 },
  ],
  March: [
    { label: 'Week 1', sales: 70200 },
    { label: 'Week 2', sales: 73900 },
    { label: 'Week 3', sales: 78300 },
    { label: 'Week 4', sales: 80900 },
  ],
  April: [
    { label: 'Week 1', sales: 74100 },
    { label: 'Week 2', sales: 79500 },
    { label: 'Week 3', sales: 81200 },
    { label: 'Week 4', sales: 85600 },
  ],
  May: [
    { label: 'Week 1', sales: 76000 },
    { label: 'Week 2', sales: 80400 },
    { label: 'Week 3', sales: 83500 },
    { label: 'Week 4', sales: 88000 },
  ],
};

const yearlyData: TimelineData = {
  2022: [
    { label: 'Q1', sales: 520000 },
    { label: 'Q2', sales: 558000 },
    { label: 'Q3', sales: 602000 },
    { label: 'Q4', sales: 634000 },
  ],
  2023: [
    { label: 'Q1', sales: 570000 },
    { label: 'Q2', sales: 619000 },
    { label: 'Q3', sales: 655000 },
    { label: 'Q4', sales: 701000 },
  ],
  2024: [
    { label: 'Q1', sales: 610000 },
    { label: 'Q2', sales: 668000 },
    { label: 'Q3', sales: 724000 },
    { label: 'Q4', sales: 776000 },
  ],
  2025: [
    { label: 'Q1', sales: 690000 },
    { label: 'Q2', sales: 745000 },
    { label: 'Q3', sales: 791000 },
    { label: 'Q4', sales: 842000 },
  ],
};

type ProfitPoint = {
  label: string;
  revenue: number;
  expenses: number;
};

type ProfitTimelineData = Record<string, ProfitPoint[]>;
type ForecastPoint = {
  label: string;
  actualDemand: number;
  forecastDemand: number;
  forecastLower: number;
  forecastUpper: number;
  customPrintShare: number;
  retailShare: number;
};
type ForecastTimelineData = Record<string, ForecastPoint[]>;
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

const weeklyProfitData: ProfitTimelineData = {
  'Week 1': [
    { label: 'Mon', revenue: 9000, expenses: 5900 },
    { label: 'Tue', revenue: 11200, expenses: 7100 },
    { label: 'Wed', revenue: 10400, expenses: 6900 },
    { label: 'Thu', revenue: 12800, expenses: 7900 },
    { label: 'Fri', revenue: 14900, expenses: 9100 },
    { label: 'Sat', revenue: 16500, expenses: 9600 },
    { label: 'Sun', revenue: 12100, expenses: 7600 },
  ],
  'Week 2': [
    { label: 'Mon', revenue: 9400, expenses: 6000 },
    { label: 'Tue', revenue: 10800, expenses: 7000 },
    { label: 'Wed', revenue: 11800, expenses: 7300 },
    { label: 'Thu', revenue: 13200, expenses: 8100 },
    { label: 'Fri', revenue: 15600, expenses: 9400 },
    { label: 'Sat', revenue: 17100, expenses: 10100 },
    { label: 'Sun', revenue: 12900, expenses: 7900 },
  ],
  'Week 3': [
    { label: 'Mon', revenue: 8600, expenses: 5600 },
    { label: 'Tue', revenue: 9700, expenses: 6400 },
    { label: 'Wed', revenue: 11000, expenses: 7000 },
    { label: 'Thu', revenue: 12100, expenses: 7600 },
    { label: 'Fri', revenue: 13800, expenses: 8700 },
    { label: 'Sat', revenue: 15900, expenses: 9300 },
    { label: 'Sun', revenue: 11600, expenses: 7300 },
  ],
  'Week 4': [
    { label: 'Mon', revenue: 10100, expenses: 6300 },
    { label: 'Tue', revenue: 11700, expenses: 7300 },
    { label: 'Wed', revenue: 12600, expenses: 7800 },
    { label: 'Thu', revenue: 13400, expenses: 8200 },
    { label: 'Fri', revenue: 16400, expenses: 9800 },
    { label: 'Sat', revenue: 17900, expenses: 10500 },
    { label: 'Sun', revenue: 13600, expenses: 8100 },
  ],
};

const monthlyProfitData: ProfitTimelineData = {
  January: [
    { label: 'Week 1', revenue: 68000, expenses: 43200 },
    { label: 'Week 2', revenue: 72000, expenses: 45500 },
    { label: 'Week 3', revenue: 70500, expenses: 44800 },
    { label: 'Week 4', revenue: 76000, expenses: 47200 },
  ],
  February: [
    { label: 'Week 1', revenue: 65000, expenses: 42000 },
    { label: 'Week 2', revenue: 69400, expenses: 43600 },
    { label: 'Week 3', revenue: 71000, expenses: 44500 },
    { label: 'Week 4', revenue: 74800, expenses: 46300 },
  ],
  March: [
    { label: 'Week 1', revenue: 70200, expenses: 44100 },
    { label: 'Week 2', revenue: 73900, expenses: 45800 },
    { label: 'Week 3', revenue: 78300, expenses: 48000 },
    { label: 'Week 4', revenue: 80900, expenses: 49700 },
  ],
  April: [
    { label: 'Week 1', revenue: 74100, expenses: 45900 },
    { label: 'Week 2', revenue: 79500, expenses: 48600 },
    { label: 'Week 3', revenue: 81200, expenses: 49800 },
    { label: 'Week 4', revenue: 85600, expenses: 52100 },
  ],
  May: [
    { label: 'Week 1', revenue: 76000, expenses: 46800 },
    { label: 'Week 2', revenue: 80400, expenses: 49100 },
    { label: 'Week 3', revenue: 83500, expenses: 50700 },
    { label: 'Week 4', revenue: 88000, expenses: 53100 },
  ],
};

const yearlyProfitData: ProfitTimelineData = {
  2022: [
    { label: 'Q1', revenue: 520000, expenses: 344000 },
    { label: 'Q2', revenue: 558000, expenses: 362000 },
    { label: 'Q3', revenue: 602000, expenses: 388000 },
    { label: 'Q4', revenue: 634000, expenses: 404000 },
  ],
  2023: [
    { label: 'Q1', revenue: 570000, expenses: 366000 },
    { label: 'Q2', revenue: 619000, expenses: 392000 },
    { label: 'Q3', revenue: 655000, expenses: 412000 },
    { label: 'Q4', revenue: 701000, expenses: 435000 },
  ],
  2024: [
    { label: 'Q1', revenue: 610000, expenses: 385000 },
    { label: 'Q2', revenue: 668000, expenses: 418000 },
    { label: 'Q3', revenue: 724000, expenses: 446000 },
    { label: 'Q4', revenue: 776000, expenses: 475000 },
  ],
  2025: [
    { label: 'Q1', revenue: 690000, expenses: 425000 },
    { label: 'Q2', revenue: 745000, expenses: 452000 },
    { label: 'Q3', revenue: 791000, expenses: 481000 },
    { label: 'Q4', revenue: 842000, expenses: 509000 },
  ],
};

const weeklyForecastData: ForecastTimelineData = {
  'Week 1': [
    { label: 'Mon', actualDemand: 92, forecastDemand: 95, forecastLower: 88, forecastUpper: 103, customPrintShare: 64, retailShare: 36 },
    { label: 'Tue', actualDemand: 98, forecastDemand: 101, forecastLower: 94, forecastUpper: 109, customPrintShare: 66, retailShare: 34 },
    { label: 'Wed', actualDemand: 103, forecastDemand: 106, forecastLower: 98, forecastUpper: 114, customPrintShare: 67, retailShare: 33 },
    { label: 'Thu', actualDemand: 109, forecastDemand: 112, forecastLower: 104, forecastUpper: 120, customPrintShare: 68, retailShare: 32 },
    { label: 'Fri', actualDemand: 121, forecastDemand: 124, forecastLower: 115, forecastUpper: 133, customPrintShare: 70, retailShare: 30 },
    { label: 'Sat', actualDemand: 132, forecastDemand: 136, forecastLower: 126, forecastUpper: 145, customPrintShare: 71, retailShare: 29 },
    { label: 'Sun', actualDemand: 111, forecastDemand: 115, forecastLower: 106, forecastUpper: 123, customPrintShare: 69, retailShare: 31 },
  ],
  'Week 2': [
    { label: 'Mon', actualDemand: 95, forecastDemand: 98, forecastLower: 90, forecastUpper: 106, customPrintShare: 65, retailShare: 35 },
    { label: 'Tue', actualDemand: 102, forecastDemand: 104, forecastLower: 96, forecastUpper: 112, customPrintShare: 66, retailShare: 34 },
    { label: 'Wed', actualDemand: 108, forecastDemand: 110, forecastLower: 102, forecastUpper: 118, customPrintShare: 67, retailShare: 33 },
    { label: 'Thu', actualDemand: 114, forecastDemand: 117, forecastLower: 108, forecastUpper: 126, customPrintShare: 68, retailShare: 32 },
    { label: 'Fri', actualDemand: 126, forecastDemand: 129, forecastLower: 120, forecastUpper: 138, customPrintShare: 70, retailShare: 30 },
    { label: 'Sat', actualDemand: 139, forecastDemand: 142, forecastLower: 132, forecastUpper: 152, customPrintShare: 72, retailShare: 28 },
    { label: 'Sun', actualDemand: 118, forecastDemand: 121, forecastLower: 112, forecastUpper: 130, customPrintShare: 69, retailShare: 31 },
  ],
  'Week 3': [
    { label: 'Mon', actualDemand: 90, forecastDemand: 93, forecastLower: 85, forecastUpper: 101, customPrintShare: 64, retailShare: 36 },
    { label: 'Tue', actualDemand: 96, forecastDemand: 99, forecastLower: 91, forecastUpper: 107, customPrintShare: 65, retailShare: 35 },
    { label: 'Wed', actualDemand: 101, forecastDemand: 104, forecastLower: 96, forecastUpper: 112, customPrintShare: 66, retailShare: 34 },
    { label: 'Thu', actualDemand: 107, forecastDemand: 110, forecastLower: 102, forecastUpper: 118, customPrintShare: 67, retailShare: 33 },
    { label: 'Fri', actualDemand: 119, forecastDemand: 122, forecastLower: 114, forecastUpper: 131, customPrintShare: 69, retailShare: 31 },
    { label: 'Sat', actualDemand: 128, forecastDemand: 132, forecastLower: 123, forecastUpper: 141, customPrintShare: 70, retailShare: 30 },
    { label: 'Sun', actualDemand: 109, forecastDemand: 112, forecastLower: 104, forecastUpper: 120, customPrintShare: 68, retailShare: 32 },
  ],
  'Week 4': [
    { label: 'Mon', actualDemand: 104, forecastDemand: 107, forecastLower: 99, forecastUpper: 115, customPrintShare: 66, retailShare: 34 },
    { label: 'Tue', actualDemand: 110, forecastDemand: 114, forecastLower: 106, forecastUpper: 123, customPrintShare: 67, retailShare: 33 },
    { label: 'Wed', actualDemand: 116, forecastDemand: 120, forecastLower: 111, forecastUpper: 129, customPrintShare: 68, retailShare: 32 },
    { label: 'Thu', actualDemand: 123, forecastDemand: 127, forecastLower: 117, forecastUpper: 136, customPrintShare: 69, retailShare: 31 },
    { label: 'Fri', actualDemand: 136, forecastDemand: 140, forecastLower: 130, forecastUpper: 150, customPrintShare: 71, retailShare: 29 },
    { label: 'Sat', actualDemand: 148, forecastDemand: 152, forecastLower: 141, forecastUpper: 163, customPrintShare: 72, retailShare: 28 },
    { label: 'Sun', actualDemand: 126, forecastDemand: 130, forecastLower: 121, forecastUpper: 140, customPrintShare: 70, retailShare: 30 },
  ],
};

const monthlyForecastData: ForecastTimelineData = {
  January: [
    { label: 'Week 1', actualDemand: 680, forecastDemand: 700, forecastLower: 665, forecastUpper: 735, customPrintShare: 62, retailShare: 38 },
    { label: 'Week 2', actualDemand: 710, forecastDemand: 730, forecastLower: 695, forecastUpper: 765, customPrintShare: 63, retailShare: 37 },
    { label: 'Week 3', actualDemand: 704, forecastDemand: 724, forecastLower: 690, forecastUpper: 758, customPrintShare: 64, retailShare: 36 },
    { label: 'Week 4', actualDemand: 748, forecastDemand: 770, forecastLower: 733, forecastUpper: 807, customPrintShare: 65, retailShare: 35 },
  ],
  February: [
    { label: 'Week 1', actualDemand: 655, forecastDemand: 676, forecastLower: 642, forecastUpper: 710, customPrintShare: 62, retailShare: 38 },
    { label: 'Week 2', actualDemand: 689, forecastDemand: 708, forecastLower: 675, forecastUpper: 741, customPrintShare: 63, retailShare: 37 },
    { label: 'Week 3', actualDemand: 700, forecastDemand: 720, forecastLower: 686, forecastUpper: 754, customPrintShare: 64, retailShare: 36 },
    { label: 'Week 4', actualDemand: 736, forecastDemand: 758, forecastLower: 722, forecastUpper: 794, customPrintShare: 65, retailShare: 35 },
  ],
  March: [
    { label: 'Week 1', actualDemand: 708, forecastDemand: 730, forecastLower: 694, forecastUpper: 766, customPrintShare: 64, retailShare: 36 },
    { label: 'Week 2', actualDemand: 742, forecastDemand: 766, forecastLower: 729, forecastUpper: 803, customPrintShare: 65, retailShare: 35 },
    { label: 'Week 3', actualDemand: 778, forecastDemand: 802, forecastLower: 763, forecastUpper: 841, customPrintShare: 66, retailShare: 34 },
    { label: 'Week 4', actualDemand: 806, forecastDemand: 832, forecastLower: 792, forecastUpper: 872, customPrintShare: 67, retailShare: 33 },
  ],
  April: [
    { label: 'Week 1', actualDemand: 744, forecastDemand: 768, forecastLower: 730, forecastUpper: 806, customPrintShare: 65, retailShare: 35 },
    { label: 'Week 2', actualDemand: 792, forecastDemand: 818, forecastLower: 778, forecastUpper: 858, customPrintShare: 66, retailShare: 34 },
    { label: 'Week 3', actualDemand: 814, forecastDemand: 840, forecastLower: 799, forecastUpper: 881, customPrintShare: 67, retailShare: 33 },
    { label: 'Week 4', actualDemand: 854, forecastDemand: 882, forecastLower: 839, forecastUpper: 925, customPrintShare: 68, retailShare: 32 },
  ],
  May: [
    { label: 'Week 1', actualDemand: 761, forecastDemand: 786, forecastLower: 747, forecastUpper: 825, customPrintShare: 66, retailShare: 34 },
    { label: 'Week 2', actualDemand: 807, forecastDemand: 834, forecastLower: 793, forecastUpper: 875, customPrintShare: 67, retailShare: 33 },
    { label: 'Week 3', actualDemand: 838, forecastDemand: 866, forecastLower: 823, forecastUpper: 909, customPrintShare: 68, retailShare: 32 },
    { label: 'Week 4', actualDemand: 879, forecastDemand: 909, forecastLower: 864, forecastUpper: 954, customPrintShare: 69, retailShare: 31 },
  ],
};

const yearlyForecastData: ForecastTimelineData = {
  2022: [
    { label: 'Q1', actualDemand: 5900, forecastDemand: 6060, forecastLower: 5790, forecastUpper: 6330, customPrintShare: 61, retailShare: 39 },
    { label: 'Q2', actualDemand: 6220, forecastDemand: 6400, forecastLower: 6100, forecastUpper: 6700, customPrintShare: 62, retailShare: 38 },
    { label: 'Q3', actualDemand: 6630, forecastDemand: 6830, forecastLower: 6500, forecastUpper: 7160, customPrintShare: 63, retailShare: 37 },
    { label: 'Q4', actualDemand: 7010, forecastDemand: 7240, forecastLower: 6890, forecastUpper: 7590, customPrintShare: 64, retailShare: 36 },
  ],
  2023: [
    { label: 'Q1', actualDemand: 6450, forecastDemand: 6660, forecastLower: 6340, forecastUpper: 6980, customPrintShare: 63, retailShare: 37 },
    { label: 'Q2', actualDemand: 6810, forecastDemand: 7040, forecastLower: 6700, forecastUpper: 7380, customPrintShare: 64, retailShare: 36 },
    { label: 'Q3', actualDemand: 7240, forecastDemand: 7480, forecastLower: 7120, forecastUpper: 7840, customPrintShare: 65, retailShare: 35 },
    { label: 'Q4', actualDemand: 7690, forecastDemand: 7950, forecastLower: 7560, forecastUpper: 8340, customPrintShare: 66, retailShare: 34 },
  ],
  2024: [
    { label: 'Q1', actualDemand: 6910, forecastDemand: 7160, forecastLower: 6780, forecastUpper: 7540, customPrintShare: 65, retailShare: 35 },
    { label: 'Q2', actualDemand: 7380, forecastDemand: 7650, forecastLower: 7240, forecastUpper: 8060, customPrintShare: 66, retailShare: 34 },
    { label: 'Q3', actualDemand: 7840, forecastDemand: 8120, forecastLower: 7700, forecastUpper: 8540, customPrintShare: 67, retailShare: 33 },
    { label: 'Q4', actualDemand: 8360, forecastDemand: 8650, forecastLower: 8210, forecastUpper: 9090, customPrintShare: 68, retailShare: 32 },
  ],
  2025: [
    { label: 'Q1', actualDemand: 7580, forecastDemand: 7860, forecastLower: 7440, forecastUpper: 8280, customPrintShare: 67, retailShare: 33 },
    { label: 'Q2', actualDemand: 8090, forecastDemand: 8390, forecastLower: 7940, forecastUpper: 8840, customPrintShare: 68, retailShare: 32 },
    { label: 'Q3', actualDemand: 8520, forecastDemand: 8830, forecastLower: 8660, forecastUpper: 9000, customPrintShare: 69, retailShare: 31 },
    { label: 'Q4', actualDemand: 9070, forecastDemand: 9400, forecastLower: 8910, forecastUpper: 9890, customPrintShare: 70, retailShare: 30 },
  ],
};

const periodMap: Record<Period, TimelineData> = {
  weekly: weeklyData,
  monthly: monthlyData,
  yearly: yearlyData,
};

const profitPeriodMap: Record<Period, ProfitTimelineData> = {
  weekly: weeklyProfitData,
  monthly: monthlyProfitData,
  yearly: yearlyProfitData,
};

const forecastPeriodMap: Record<Period, ForecastTimelineData> = {
  weekly: weeklyForecastData,
  monthly: monthlyForecastData,
  yearly: yearlyForecastData,
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
          Generate insights to view a fixed mini-report with consistent AI-style output.
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
  const [selectionA, setSelectionA] = useState('April');
  const [selectionB, setSelectionB] = useState('January');
  const [profitSelection, setProfitSelection] = useState('April');
  const [marginSortOrder, setMarginSortOrder] = useState<'desc' | 'asc'>('desc');
  const [trendSelection, setTrendSelection] = useState('April');
  const [forecastSelection, setForecastSelection] = useState('April');
  const [forecastMetric, setForecastMetric] = useState<'income' | 'expenses'>('income');
  const [salesInsight, setSalesInsight] = useState<InsightState>(emptyInsightState);
  const [profitInsight, setProfitInsight] = useState<InsightState>(emptyInsightState);
  const [trendInsight, setTrendInsight] = useState<InsightState>(emptyInsightState);
  const [forecastInsight, setForecastInsight] = useState<InsightState>(emptyInsightState);

  const salesOptions = useMemo(() => Object.keys(periodMap[salesPeriod]), [salesPeriod]);
  const profitOptions = useMemo(() => Object.keys(periodMap[profitPeriod]), [profitPeriod]);
  const trendOptions = useMemo(() => Object.keys(periodMap[trendPeriod]), [trendPeriod]);
  const forecastOptions = useMemo(() => Object.keys(periodMap[forecastPeriod]), [forecastPeriod]);

  const safeSelectionA = salesOptions.includes(selectionA) ? selectionA : salesOptions[0];
  const safeSelectionB = salesOptions.includes(selectionB)
    ? selectionB
    : salesOptions[Math.min(1, salesOptions.length - 1)];

  const comparisonData = useMemo(() => {
    const seriesA = periodMap[salesPeriod][safeSelectionA] ?? [];
    const seriesB = periodMap[salesPeriod][safeSelectionB] ?? [];
    const maxLength = Math.max(seriesA.length, seriesB.length);

    return Array.from({ length: maxLength }).map((_, index) => {
      const itemA = seriesA[index];
      const itemB = seriesB[index];
      const valueA = itemA?.sales ?? 0;
      const valueB = itemB?.sales ?? 0;

      return {
        label: itemA?.label ?? itemB?.label ?? `Point ${index + 1}`,
        timelineA: valueA,
        timelineB: valueB,
        delta: valueA - valueB,
      };
    });
  }, [salesPeriod, safeSelectionA, safeSelectionB]);

  const totals = useMemo(() => {
    const totalA = comparisonData.reduce((acc, item) => acc + item.timelineA, 0);
    const totalB = comparisonData.reduce((acc, item) => acc + item.timelineB, 0);
    const absoluteDiff = totalA - totalB;
    const growth = totalB === 0 ? 0 : (absoluteDiff / totalB) * 100;

    return { totalA, totalB, absoluteDiff, growth };
  }, [comparisonData]);

  const safeProfitSelection = profitOptions.includes(profitSelection)
    ? profitSelection
    : profitOptions[0];

  const profitMarginData = useMemo(() => {
    const source = profitPeriodMap[profitPeriod][safeProfitSelection] ?? [];
    return source.map((item) => {
      const profit = item.revenue - item.expenses;
      const margin = item.revenue === 0 ? 0 : (profit / item.revenue) * 100;
      return {
        ...item,
        profit,
        margin,
      };
    });
  }, [profitPeriod, safeProfitSelection]);

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

    return {
      totalRevenue,
      totalExpenses,
      totalProfit,
      averageMargin,
      bestPoint,
      lowestPoint,
    };
  }, [profitMarginData]);

  const sortedMarginRows = useMemo(() => {
    return [...profitMarginData].sort((a, b) => {
      if (marginSortOrder === 'desc') return b.margin - a.margin;
      return a.margin - b.margin;
    });
  }, [profitMarginData, marginSortOrder]);

  type ProductTrendPoint = {
    label: string;
    tshirt: number;
    mug: number;
    sticker: number;
    tarpaulin: number;
    idLace: number;
  };

  type ProductTrendTimelineData = Record<string, ProductTrendPoint[]>;

  const weeklyProductTrendData: ProductTrendTimelineData = {
    'Week 1': [
      { label: 'Mon', tshirt: 28, mug: 18, sticker: 35, tarpaulin: 9, idLace: 14 },
      { label: 'Tue', tshirt: 30, mug: 19, sticker: 38, tarpaulin: 10, idLace: 15 },
      { label: 'Wed', tshirt: 31, mug: 21, sticker: 36, tarpaulin: 11, idLace: 16 },
      { label: 'Thu', tshirt: 34, mug: 22, sticker: 40, tarpaulin: 11, idLace: 17 },
      { label: 'Fri', tshirt: 38, mug: 24, sticker: 44, tarpaulin: 12, idLace: 19 },
      { label: 'Sat', tshirt: 42, mug: 26, sticker: 48, tarpaulin: 14, idLace: 21 },
      { label: 'Sun', tshirt: 33, mug: 20, sticker: 39, tarpaulin: 10, idLace: 16 },
    ],
    'Week 2': [
      { label: 'Mon', tshirt: 29, mug: 18, sticker: 36, tarpaulin: 10, idLace: 14 },
      { label: 'Tue', tshirt: 31, mug: 20, sticker: 37, tarpaulin: 10, idLace: 15 },
      { label: 'Wed', tshirt: 34, mug: 21, sticker: 40, tarpaulin: 11, idLace: 17 },
      { label: 'Thu', tshirt: 36, mug: 23, sticker: 42, tarpaulin: 12, idLace: 18 },
      { label: 'Fri', tshirt: 40, mug: 24, sticker: 46, tarpaulin: 13, idLace: 20 },
      { label: 'Sat', tshirt: 44, mug: 27, sticker: 49, tarpaulin: 14, idLace: 22 },
      { label: 'Sun', tshirt: 35, mug: 21, sticker: 40, tarpaulin: 11, idLace: 17 },
    ],
    'Week 3': [
      { label: 'Mon', tshirt: 26, mug: 17, sticker: 33, tarpaulin: 9, idLace: 13 },
      { label: 'Tue', tshirt: 28, mug: 18, sticker: 34, tarpaulin: 10, idLace: 14 },
      { label: 'Wed', tshirt: 30, mug: 20, sticker: 37, tarpaulin: 10, idLace: 15 },
      { label: 'Thu', tshirt: 32, mug: 21, sticker: 39, tarpaulin: 11, idLace: 16 },
      { label: 'Fri', tshirt: 35, mug: 22, sticker: 42, tarpaulin: 12, idLace: 18 },
      { label: 'Sat', tshirt: 39, mug: 24, sticker: 45, tarpaulin: 13, idLace: 20 },
      { label: 'Sun', tshirt: 31, mug: 19, sticker: 37, tarpaulin: 10, idLace: 15 },
    ],
    'Week 4': [
      { label: 'Mon', tshirt: 31, mug: 20, sticker: 38, tarpaulin: 10, idLace: 15 },
      { label: 'Tue', tshirt: 33, mug: 21, sticker: 40, tarpaulin: 11, idLace: 16 },
      { label: 'Wed', tshirt: 35, mug: 22, sticker: 43, tarpaulin: 12, idLace: 17 },
      { label: 'Thu', tshirt: 37, mug: 23, sticker: 44, tarpaulin: 12, idLace: 18 },
      { label: 'Fri', tshirt: 42, mug: 25, sticker: 48, tarpaulin: 13, idLace: 20 },
      { label: 'Sat', tshirt: 45, mug: 28, sticker: 52, tarpaulin: 15, idLace: 23 },
      { label: 'Sun', tshirt: 36, mug: 22, sticker: 42, tarpaulin: 11, idLace: 17 },
    ],
  };

  const monthlyProductTrendData: ProductTrendTimelineData = {
    January: [
      { label: 'Week 1', tshirt: 180, mug: 110, sticker: 230, tarpaulin: 64, idLace: 92 },
      { label: 'Week 2', tshirt: 192, mug: 118, sticker: 242, tarpaulin: 68, idLace: 98 },
      { label: 'Week 3', tshirt: 188, mug: 116, sticker: 238, tarpaulin: 66, idLace: 95 },
      { label: 'Week 4', tshirt: 201, mug: 124, sticker: 251, tarpaulin: 71, idLace: 102 },
    ],
    February: [
      { label: 'Week 1', tshirt: 174, mug: 106, sticker: 221, tarpaulin: 61, idLace: 89 },
      { label: 'Week 2', tshirt: 186, mug: 113, sticker: 232, tarpaulin: 64, idLace: 93 },
      { label: 'Week 3', tshirt: 189, mug: 115, sticker: 235, tarpaulin: 66, idLace: 96 },
      { label: 'Week 4', tshirt: 198, mug: 121, sticker: 246, tarpaulin: 70, idLace: 100 },
    ],
    March: [
      { label: 'Week 1', tshirt: 191, mug: 117, sticker: 240, tarpaulin: 67, idLace: 97 },
      { label: 'Week 2', tshirt: 202, mug: 124, sticker: 252, tarpaulin: 72, idLace: 103 },
      { label: 'Week 3', tshirt: 214, mug: 130, sticker: 264, tarpaulin: 76, idLace: 109 },
      { label: 'Week 4', tshirt: 220, mug: 136, sticker: 273, tarpaulin: 79, idLace: 113 },
    ],
    April: [
      { label: 'Week 1', tshirt: 208, mug: 126, sticker: 258, tarpaulin: 74, idLace: 106 },
      { label: 'Week 2', tshirt: 223, mug: 134, sticker: 272, tarpaulin: 79, idLace: 112 },
      { label: 'Week 3', tshirt: 229, mug: 139, sticker: 281, tarpaulin: 82, idLace: 116 },
      { label: 'Week 4', tshirt: 240, mug: 146, sticker: 294, tarpaulin: 86, idLace: 121 },
    ],
    May: [
      { label: 'Week 1', tshirt: 214, mug: 131, sticker: 266, tarpaulin: 76, idLace: 110 },
      { label: 'Week 2', tshirt: 226, mug: 138, sticker: 279, tarpaulin: 81, idLace: 116 },
      { label: 'Week 3', tshirt: 235, mug: 143, sticker: 289, tarpaulin: 84, idLace: 120 },
      { label: 'Week 4', tshirt: 248, mug: 151, sticker: 302, tarpaulin: 88, idLace: 126 },
    ],
  };

  const yearlyProductTrendData: ProductTrendTimelineData = {
    2022: [
      { label: 'Q1', tshirt: 2120, mug: 1310, sticker: 2810, tarpaulin: 790, idLace: 1120 },
      { label: 'Q2', tshirt: 2260, mug: 1380, sticker: 2940, tarpaulin: 850, idLace: 1180 },
      { label: 'Q3', tshirt: 2430, mug: 1490, sticker: 3120, tarpaulin: 890, idLace: 1260 },
      { label: 'Q4', tshirt: 2550, mug: 1550, sticker: 3270, tarpaulin: 940, idLace: 1320 },
    ],
    2023: [
      { label: 'Q1', tshirt: 2330, mug: 1420, sticker: 3040, tarpaulin: 860, idLace: 1210 },
      { label: 'Q2', tshirt: 2480, mug: 1530, sticker: 3220, tarpaulin: 920, idLace: 1290 },
      { label: 'Q3', tshirt: 2620, mug: 1600, sticker: 3370, tarpaulin: 970, idLace: 1360 },
      { label: 'Q4', tshirt: 2790, mug: 1690, sticker: 3540, tarpaulin: 1030, idLace: 1450 },
    ],
    2024: [
      { label: 'Q1', tshirt: 2480, mug: 1510, sticker: 3260, tarpaulin: 920, idLace: 1310 },
      { label: 'Q2', tshirt: 2680, mug: 1620, sticker: 3460, tarpaulin: 990, idLace: 1400 },
      { label: 'Q3', tshirt: 2870, mug: 1730, sticker: 3640, tarpaulin: 1060, idLace: 1490 },
      { label: 'Q4', tshirt: 3040, mug: 1830, sticker: 3820, tarpaulin: 1130, idLace: 1570 },
    ],
    2025: [
      { label: 'Q1', tshirt: 2760, mug: 1670, sticker: 3540, tarpaulin: 1000, idLace: 1440 },
      { label: 'Q2', tshirt: 2940, mug: 1770, sticker: 3740, tarpaulin: 1090, idLace: 1530 },
      { label: 'Q3', tshirt: 3090, mug: 1860, sticker: 3920, tarpaulin: 1160, idLace: 1620 },
      { label: 'Q4', tshirt: 3280, mug: 1980, sticker: 4140, tarpaulin: 1240, idLace: 1720 },
    ],
  };

  const trendPeriodMap: Record<Period, ProductTrendTimelineData> = {
    weekly: weeklyProductTrendData,
    monthly: monthlyProductTrendData,
    yearly: yearlyProductTrendData,
  };

  const safeTrendSelection = trendOptions.includes(trendSelection)
    ? trendSelection
    : trendOptions[0];
  const safeForecastSelection = forecastOptions.includes(forecastSelection)
    ? forecastSelection
    : forecastOptions[0];

  const productTrendData = useMemo(() => {
    const source = trendPeriodMap[trendPeriod][safeTrendSelection] ?? [];
    return source.map((item) => {
      const totalUnits = item.tshirt + item.mug + item.sticker + item.tarpaulin + item.idLace;
      return {
        ...item,
        totalUnits,
      };
    });
  }, [trendPeriod, safeTrendSelection]);

  const productTrendSummary = useMemo(() => {
    const totals = productTrendData.reduce(
      (acc, item) => {
        acc.tshirt += item.tshirt;
        acc.mug += item.mug;
        acc.sticker += item.sticker;
        acc.tarpaulin += item.tarpaulin;
        acc.idLace += item.idLace;
        acc.total += item.totalUnits;
        return acc;
      },
      { tshirt: 0, mug: 0, sticker: 0, tarpaulin: 0, idLace: 0, total: 0 },
    );

    const products = [
      { name: 'T-Shirt', units: totals.tshirt },
      { name: 'Mug', units: totals.mug },
      { name: 'Sticker', units: totals.sticker },
      { name: 'Tarpaulin', units: totals.tarpaulin },
      { name: 'ID Lace', units: totals.idLace },
    ];

    const ranked = [...products].sort((a, b) => b.units - a.units);
    const leadingProduct = ranked[0];
    const lowestProduct = ranked[ranked.length - 1];

    return { totals, ranked, leadingProduct, lowestProduct };
  }, [productTrendData]);

  const demandForecastData = useMemo(() => {
    return forecastPeriodMap[forecastPeriod][safeForecastSelection] ?? [];
  }, [forecastPeriod, safeForecastSelection]);

  const financialForecastData = useMemo(() => {
    return demandForecastData.map((item) => {
      const incomeActual = item.actualDemand * 980;
      const incomeForecast = item.forecastDemand * 1020;
      const incomeLower = item.forecastLower * 1010;
      const incomeUpper = item.forecastUpper * 1030;
      const expenseActual = item.actualDemand * 610;
      const expenseForecast = item.forecastDemand * 635;
      const expenseLower = item.forecastLower * 625;
      const expenseUpper = item.forecastUpper * 645;

      return {
        label: item.label,
        incomeActual,
        incomeForecast,
        incomeLower,
        incomeUpper,
        expenseActual,
        expenseForecast,
        expenseLower,
        expenseUpper,
      };
    });
  }, [demandForecastData]);

  const financialForecastChartData = useMemo(() => {
    const presentCutoffIndex = Math.max(0, financialForecastData.length - 2);

    return financialForecastData.map((item, index) => {
      const actualValue = forecastMetric === 'income' ? item.incomeActual : item.expenseActual;
      const forecastValue = forecastMetric === 'income' ? item.incomeForecast : item.expenseForecast;

      return {
        label: item.label,
        actualSeries: index <= presentCutoffIndex ? actualValue : null,
        // Force the forecast to begin at the exact last actual point for a seamless continuation.
        forecastSeries:
          index < presentCutoffIndex
            ? null
            : index === presentCutoffIndex
              ? actualValue
              : forecastValue,
      };
    });
  }, [financialForecastData, forecastMetric]);

  const financialForecastStats = useMemo(() => {
    const totals = financialForecastData.reduce(
      (acc, item) => {
        const actual = forecastMetric === 'income' ? item.incomeActual : item.expenseActual;
        const forecast = forecastMetric === 'income' ? item.incomeForecast : item.expenseForecast;
        const lower = forecastMetric === 'income' ? item.incomeLower : item.expenseLower;
        const upper = forecastMetric === 'income' ? item.incomeUpper : item.expenseUpper;
        acc.actual += actual;
        acc.forecast += forecast;
        acc.lower += lower;
        acc.upper += upper;
        return acc;
      },
      { actual: 0, forecast: 0, lower: 0, upper: 0 },
    );

    const expectedDelta = totals.forecast - totals.actual;
    const expectedGrowth = totals.actual === 0 ? 0 : (expectedDelta / totals.actual) * 100;
    const uncertaintyBand = totals.upper - totals.lower;
    const forecastAccuracyProxy = totals.forecast === 0 ? 0 : 100 - (Math.abs(expectedDelta) / totals.forecast) * 100;

    return {
      ...totals,
      expectedDelta,
      expectedGrowth,
      uncertaintyBand,
      forecastAccuracyProxy,
    };
  }, [financialForecastData, forecastMetric]);

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
      totalUnits: productTrendSummary.totals.total,
      leadingProduct: productTrendSummary.leadingProduct?.name ?? '-',
      leadingUnits: productTrendSummary.leadingProduct?.units ?? 0,
      lowestProduct: productTrendSummary.lowestProduct?.name ?? '-',
    });
    setTrendInsight((prev) => ({
      ...prev,
      isLoading: false,
      report,
      lastGeneratedAt: new Date().toISOString(),
    }));
  }, [
    productTrendSummary.totals.total,
    productTrendSummary.leadingProduct?.name,
    productTrendSummary.leadingProduct?.units,
    productTrendSummary.lowestProduct?.name,
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
    forecastMetric,
    financialForecastStats.expectedGrowth,
    financialForecastStats.forecastAccuracyProxy,
    financialForecastStats.actual,
    financialForecastStats.forecast,
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

  const applyGlobalPeriod = (nextPeriod: Period) => {
    setGlobalPeriod(nextPeriod);
    setSalesPeriod(nextPeriod);
    setProfitPeriod(nextPeriod);
    setTrendPeriod(nextPeriod);
    setForecastPeriod(nextPeriod);

    const nextSalesOptions = Object.keys(periodMap[nextPeriod]);
    setSelectionA(nextSalesOptions[0] ?? '');
    setSelectionB(nextSalesOptions[Math.min(1, nextSalesOptions.length - 1)] ?? '');

    const nextProfitOptions = Object.keys(profitPeriodMap[nextPeriod]);
    setProfitSelection(nextProfitOptions[0] ?? '');

    const nextTrendOptions = Object.keys(trendPeriodMap[nextPeriod]);
    setTrendSelection(nextTrendOptions[0] ?? '');
    const nextForecastOptions = Object.keys(forecastPeriodMap[nextPeriod]);
    setForecastSelection(nextForecastOptions[0] ?? '');
  };

  const handleSalesPeriodChange = (nextPeriod: Period) => {
    setSalesPeriod(nextPeriod);
    const nextOptions = Object.keys(periodMap[nextPeriod]);
    setSelectionA(nextOptions[0] ?? '');
    setSelectionB(nextOptions[Math.min(1, nextOptions.length - 1)] ?? '');
  };

  const handleProfitPeriodChange = (nextPeriod: Period) => {
    setProfitPeriod(nextPeriod);
    const nextOptions = Object.keys(profitPeriodMap[nextPeriod]);
    setProfitSelection(nextOptions[0] ?? '');
  };

  const handleTrendPeriodChange = (nextPeriod: Period) => {
    setTrendPeriod(nextPeriod);
    const nextOptions = Object.keys(trendPeriodMap[nextPeriod]);
    setTrendSelection(nextOptions[0] ?? '');
  };

  const handleForecastPeriodChange = (nextPeriod: Period) => {
    setForecastPeriod(nextPeriod);
    const nextOptions = Object.keys(forecastPeriodMap[nextPeriod]);
    setForecastSelection(nextOptions[0] ?? '');
  };

  return (
    <div className="space-y-4 pb-8">
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
                  Compare two timelines by {periodLabel[salesPeriod].toLowerCase()} sales using static business data.
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
                  {salesOptions.map((option) => (
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
                  {salesOptions.map((option) => (
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
          </section>

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
                    formatter={(value: number, name: string) => [money.format(value), name]}
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
        </div>

        <section className="bg-white border border-gray-200 rounded p-4 md:p-5 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
              Profit Margin Analysis
            </h3>
            <p className="text-xs text-gray-500 mt-1 dark:text-zinc-400">
              Revenue vs expenses with margin trend for the selected {periodLabel[profitPeriod].toLowerCase()} timeline.
            </p>
          </div>
          <div className="flex flex-col md:items-end gap-2 w-full md:w-auto">
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
            <label className="block w-full md:w-52">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-zinc-400">
                Analysis Range
              </span>
              <select
                value={safeProfitSelection}
                onChange={(event) => setProfitSelection(event.target.value)}
                className="mt-1 w-full bg-white border border-gray-200 rounded px-3 py-2 text-xs text-gray-800 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-200"
              >
                {profitOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

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
            <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-zinc-400">Expenses</p>
            <p className="text-xs font-semibold text-gray-900 dark:text-zinc-100">{money.format(profitMarginStats.totalExpenses)}</p>
          </div>
          <div className="rounded border border-gray-200 p-3 dark:border-zinc-700">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-zinc-400">Net Profit</p>
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
                formatter={(value: number, name: string) => {
                  if (name === 'Margin %') return [`${value.toFixed(1)}%`, name];
                  return [money.format(value), name];
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
                name="Expenses"
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
                  <th className="px-3 py-2 font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide text-right">Expenses</th>
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
        </section>

        <section className="bg-white border border-gray-200 rounded p-4 md:p-5 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Product Trend Identification</h3>
            <p className="text-xs text-gray-500 mt-1 dark:text-zinc-400">
              Multi-product demand trend by {periodLabel[trendPeriod].toLowerCase()} segment with total volume tracking.
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
                {trendOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

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
            <p className="text-xs font-semibold text-gray-900 dark:text-zinc-100">{productTrendSummary.totals.total.toLocaleString()}</p>
          </div>
          <div className="rounded border border-gray-200 p-3 dark:border-zinc-700">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-zinc-400">Leading Product</p>
            <p className="text-xs font-semibold text-gray-900 dark:text-zinc-100">
              {productTrendSummary.leadingProduct?.name} ({productTrendSummary.leadingProduct?.units.toLocaleString()})
            </p>
          </div>
          <div className="rounded border border-gray-200 p-3 dark:border-zinc-700">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-zinc-400">Lowest Product</p>
            <p className="text-xs font-semibold text-gray-900 dark:text-zinc-100">
              {productTrendSummary.lowestProduct?.name} ({productTrendSummary.lowestProduct?.units.toLocaleString()})
            </p>
          </div>
          <div className="rounded border border-gray-200 p-3 dark:border-zinc-700">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-zinc-400">Unique Segments</p>
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
                formatter={(value: number) => [value.toLocaleString(), 'Units']}
                labelStyle={{ color: '#111827', fontSize: 12 }}
                contentStyle={{ border: '1px solid #E5E7EB', borderRadius: '6px', boxShadow: 'none', fontSize: '12px' }}
              />
              <Legend />
              <Bar yAxisId="units" dataKey="tshirt" name="T-Shirt" stackId="product" fill="#111827" isAnimationActive={false} />
              <Bar yAxisId="units" dataKey="mug" name="Mug" stackId="product" fill="#374151" isAnimationActive={false} />
              <Bar yAxisId="units" dataKey="sticker" name="Sticker" stackId="product" fill="#6B7280" isAnimationActive={false} />
              <Bar yAxisId="units" dataKey="tarpaulin" name="Tarpaulin" stackId="product" fill="#9CA3AF" isAnimationActive={false} />
              <Bar yAxisId="units" dataKey="idLace" name="ID Lace" stackId="product" fill="#D1D5DB" isAnimationActive={false} />
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
                  <tr key={item.name} className="border-t border-gray-100 dark:border-zinc-800">
                    <td className="px-3 py-2 text-gray-700 dark:text-zinc-300">{index + 1}</td>
                    <td className="px-3 py-2 font-medium text-gray-800 dark:text-zinc-200">{item.name}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-900 dark:text-zinc-100">{item.units.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </section>

        <section className="bg-white border border-gray-200 rounded p-4 md:p-5 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Financial Forecasting</h3>
            <p className="text-xs text-gray-500 mt-1 dark:text-zinc-400">
              Forecasted business performance using projected income and expenses with confidence bounds.
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
            <label className="block w-full md:w-52">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-zinc-400">
                Forecast Range
              </span>
              <select
                value={safeForecastSelection}
                onChange={(event) => setForecastSelection(event.target.value)}
                className="mt-1 w-full bg-white border border-gray-200 rounded px-3 py-2 text-xs text-gray-800 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-200"
              >
                {forecastOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

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
                formatter={(value: number, name: string) => {
                  return [money.format(value), name];
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
        </section>
      </div>
    </div>
  );
}