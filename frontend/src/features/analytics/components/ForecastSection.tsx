import { useCallback, useMemo, useState } from 'react';
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
import type { InventoryForecast } from '../api/analyticsApi';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { AnalyticsSectionSkeleton } from './AnalyticsSectionSkeleton';
import {
  SegmentedControl,
  StatusLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  cellTitle,
} from '../../../shared/components/ui';
import {
  chartTooltipStyle,
  generateInsight,
  createEmptyInsightState,
  getChartColors,
  money,
  type InsightState,
  type Period,
} from './analytics-types';
import { InsightPanel } from './InsightPanel';
import { StatTile, StatTileRow } from '../../../shared/components/ui';
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
  const colors = getChartColors();

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

  return (
    <SectionCard
      title="Financial Forecasting"
      description="Forecasted inventory requirements using moving-average demand projection with confidence bounds."
      controls={<div className="space-y-2"><SegmentedControl aria-label="Forecast metric" value={forecastMetric} onChange={setForecastMetric} options={[{ value: 'income', label: 'Income', selectedClassName: 'bg-app-success text-white' }, { value: 'expenses', label: 'Expenses', selectedClassName: 'bg-app-warning text-white' }]} /><PeriodSelector value={forecastPeriod} onChange={onForecastPeriodChange} prefix="forecast" /></div>}
    >
      {isLoading ? <AnalyticsSectionSkeleton chartHeight={390} /> : error ? <ErrorState message={error} /> : !inventoryForecast || inventoryForecast.items.length === 0 ? <p className="text-xs text-app-text-muted dark:text-zinc-400">No inventory forecast data available for this period.</p> : (
        <>
          <InsightPanel state={forecastInsight} onGenerate={generateForecastInsight} />
          <div className="my-4">
            <StatTileRow columns={4}>
              <StatTile label={`Actual ${forecastMetric === 'income' ? 'Income' : 'Expenses'}`} value={money.format(financialForecastStats.actual)} />
              <StatTile label={`Forecast ${forecastMetric === 'income' ? 'Income' : 'Expenses'}`} value={money.format(financialForecastStats.forecast)} />
              <StatTile label="Expected Growth" value={`${financialForecastStats.expectedGrowth.toFixed(1)}%`} />
              <StatTile label="Forecast Confidence" value={`${Math.max(0, Math.min(100, financialForecastStats.forecastAccuracyProxy)).toFixed(1)}%`} />
            </StatTileRow>
          </div>
          <div className="h-[390px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={financialForecastChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(142,142,147,0.24)" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: colors.axis }} />
                <YAxis yAxisId="amount" axisLine={false} tickLine={false} tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: colors.axis }} />
                <RechartsTooltip formatter={(value, name) => [money.format(Number(value ?? 0)), String(name)]} labelStyle={{ color: 'var(--app-text)', fontSize: 12 }} contentStyle={chartTooltipStyle} />
                <Legend />
                <Line yAxisId="amount" type="monotone" dataKey="actualSeries" name={`Actual ${forecastMetric === 'income' ? 'Income' : 'Expenses'}`} stroke={colors.neutral} strokeWidth={3} dot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />
                <Line yAxisId="amount" type="monotone" dataKey="forecastSeries" name={`Forecast ${forecastMetric === 'income' ? 'Income' : 'Expenses'}`} stroke={colors.positive} strokeWidth={3} dot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <TableContainer className="mt-4">
            <div className="border-b p-3"><p className="text-xs font-bold text-app-ink dark:text-zinc-100">Inventory Reorder Recommendations ({inventoryForecast.horizonDays}-day horizon)</p></div>
            <Table>
              <colgroup>
                <col style={{ width: '100px' }} />
                <col style={{ width: '220px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '110px' }} />
              </colgroup>
              <TableHeader><TableRow className="hover:bg-transparent"><TableHead>Status</TableHead><TableHead>Item</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Reorder Lvl</TableHead><TableHead className="text-right">Avg Daily</TableHead><TableHead className="text-right">Forecast</TableHead><TableHead className="text-right">Reorder Qty</TableHead></TableRow></TableHeader>
              {/*
                Written out one cell per line: with a tooltip on each, the row
                was a single line of source long enough that a wrong column
                label could sit in it unnoticed for months.
              */}
              <TableBody>
                {inventoryForecast.items.slice(0, 10).map((item) => (
                  <TableRow key={item.sku}>
                    <TableCell title={cellTitle('Status', item.status)}>
                      <StatusLabel tone={item.status === 'critical' ? 'red' : item.status === 'warning' ? 'orange' : 'green'}>{item.status}</StatusLabel>
                    </TableCell>
                    <TableCell className="text-app-ink dark:text-zinc-100" title={cellTitle('Item', item.name)}>{item.name}</TableCell>
                    <TableCell className="text-right tabular-nums" title={cellTitle('Stock', item.currentStock.toLocaleString())}>{item.currentStock.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums" title={cellTitle('Reorder Lvl', item.reorderLevel.toLocaleString())}>{item.reorderLevel.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums" title={cellTitle('Avg Daily', item.avgDailyDemand.toFixed(1))}>{item.avgDailyDemand.toFixed(1)}</TableCell>
                    <TableCell className="text-right tabular-nums" title={cellTitle('Forecast', item.forecastDemand.toLocaleString())}>{item.forecastDemand.toLocaleString()}</TableCell>
                    <TableCell
                      className="text-right tabular-nums text-app-ink dark:text-zinc-100"
                      title={cellTitle('Reorder Qty', item.recommendedReorder > 0 ? item.recommendedReorder.toLocaleString() : undefined)}
                    >
                      {item.recommendedReorder > 0 ? item.recommendedReorder.toLocaleString() : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </SectionCard>
  );
}
