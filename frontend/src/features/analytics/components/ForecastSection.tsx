import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Brain } from 'lucide-react';
import type { InventoryForecast } from '../api/analyticsApi';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import {
  StatusLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../shared/components/ui';
import { cn } from '../../../shared/lib/cn';
import {
  chartTooltipStyle,
  generateInsight,
  createEmptyInsightState,
  money,
  type InsightState,
  type Period,
} from './analytics-types';
import { InsightPanel } from './InsightPanel';
import { MetricTile } from './MetricTile';
import { PeriodSelector } from './PeriodSelector';
import { SectionCard } from './SectionCard';

interface ForecastSectionProps {
  inventoryForecast: InventoryForecast | null;
  error: string | null;
  isLoading: boolean;
  forecastPeriod: Period;
  onForecastPeriodChange: (period: Period) => void;
}

export function ForecastSection({
  inventoryForecast,
  error,
  isLoading,
  forecastPeriod,
  onForecastPeriodChange,
}: ForecastSectionProps) {
  const [forecastMetric, setForecastMetric] = useState<'income' | 'expenses'>('income');
  const [forecastInsight, setForecastInsight] = useState<InsightState>(createEmptyInsightState());

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

  const generateForecastInsight = useCallback(async () => {
    setForecastInsight((prev) => ({ ...prev, isLoading: true }));
    const confidence = Math.max(0, Math.min(100, financialForecastStats.forecastAccuracyProxy));
    const report = await generateInsight('forecast', { metric: forecastMetric === 'income' ? 'Income' : 'Expenses', expectedGrowth: financialForecastStats.expectedGrowth, forecastConfidence: confidence, actual: financialForecastStats.actual, forecast: financialForecastStats.forecast });
    setForecastInsight((prev) => ({ ...prev, isLoading: false, report, lastGeneratedAt: new Date().toISOString() }));
  }, [financialForecastStats.expectedGrowth, financialForecastStats.forecastAccuracyProxy, financialForecastStats.actual, financialForecastStats.forecast, forecastMetric]);

  useEffect(() => { if (forecastInsight.autoGenerate) void generateForecastInsight(); }, [forecastInsight.autoGenerate, generateForecastInsight]);

  return (
    <SectionCard
      icon={Brain}
      title="Financial Forecasting"
      description="Forecasted inventory requirements using moving-average demand projection with confidence bounds."
      controls={<div className="space-y-2"><div className="flex rounded-full border p-1"><button type="button" onClick={() => setForecastMetric('income')} className={cn('h-8 cursor-pointer rounded-full px-3 text-2xs font-bold', forecastMetric === 'income' ? 'bg-macos-green text-white' : 'text-macos-text-muted hover:bg-[var(--app-state-hover)] dark:text-zinc-400 dark:hover:bg-[#414143]')}>Income</button><button type="button" onClick={() => setForecastMetric('expenses')} className={cn('h-8 cursor-pointer rounded-full px-3 text-2xs font-bold', forecastMetric === 'expenses' ? 'bg-macos-orange text-white' : 'text-macos-text-muted hover:bg-[var(--app-state-hover)] dark:text-zinc-400 dark:hover:bg-[#414143]')}>Expenses</button></div><PeriodSelector value={forecastPeriod} onChange={onForecastPeriodChange} prefix="forecast" /></div>}
    >
      {isLoading ? <LoadingState label="Loading inventory forecast" /> : error ? <ErrorState message={error} /> : !inventoryForecast || inventoryForecast.items.length === 0 ? <p className="text-xs text-macos-text-muted dark:text-zinc-400">No inventory forecast data available for this period.</p> : (
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
                <RechartsTooltip formatter={(value, name) => [money.format(Number(value ?? 0)), String(name)]} labelStyle={{ color: 'var(--app-text)', fontSize: 12 }} contentStyle={chartTooltipStyle} />
                <Legend />
                <Line yAxisId="amount" type="monotone" dataKey="actualSeries" name={`Actual ${forecastMetric === 'income' ? 'Income' : 'Expenses'}`} stroke="#555558" strokeWidth={3} dot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />
                <Line yAxisId="amount" type="monotone" dataKey="forecastSeries" name={`Forecast ${forecastMetric === 'income' ? 'Income' : 'Expenses'}`} stroke="#34C759" strokeWidth={3} dot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <TableContainer className="mt-4">
            <div className="border-b p-3"><p className="text-xs font-bold text-macos-text dark:text-zinc-100">Inventory Reorder Recommendations ({inventoryForecast.horizonDays}-day horizon)</p></div>
            <Table>
              <TableHeader><TableRow className="hover:bg-transparent"><TableHead>Status</TableHead><TableHead>Item</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Reorder Lvl</TableHead><TableHead className="text-right">Avg Daily</TableHead><TableHead className="text-right">Forecast</TableHead><TableHead className="text-right">Reorder Qty</TableHead></TableRow></TableHeader>
              <TableBody>{inventoryForecast.items.slice(0, 10).map((item) => <TableRow key={item.sku}><TableCell><StatusLabel tone={item.status === 'critical' ? 'red' : item.status === 'warning' ? 'orange' : 'green'}>{item.status}</StatusLabel></TableCell><TableCell className="text-macos-text dark:text-zinc-100">{item.name}</TableCell><TableCell className="text-right tabular-nums">{item.currentStock.toLocaleString()}</TableCell><TableCell className="text-right tabular-nums">{item.reorderLevel.toLocaleString()}</TableCell><TableCell className="text-right tabular-nums">{item.avgDailyDemand.toFixed(1)}</TableCell><TableCell className="text-right tabular-nums">{item.forecastDemand.toLocaleString()}</TableCell><TableCell className="text-right tabular-nums text-macos-text dark:text-zinc-100">{item.recommendedReorder > 0 ? item.recommendedReorder.toLocaleString() : '—'}</TableCell></TableRow>)}</TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </SectionCard>
  );
}
