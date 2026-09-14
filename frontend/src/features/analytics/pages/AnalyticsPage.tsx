import { useState } from 'react';
import { CalendarRange, Sparkles } from 'lucide-react';
import { GlassCard } from '../../../shared/components/ui';
import { AnalyticsSummary } from '../components/AnalyticsSummary';
import { ForecastSection } from '../components/ForecastSection';
import { PeriodSelector } from '../components/PeriodSelector';
import { ProductTrendSection } from '../components/ProductTrendSection';
import { ProfitMarginSection } from '../components/ProfitMarginSection';
import { SalesComparisonSection } from '../components/SalesComparisonSection';
import type { Period } from '../components/analytics-types';
import { useAnalyticsData } from '../hooks/useAnalyticsData';

export default function AnalyticsPage() {
  const [globalPeriod, setGlobalPeriod] = useState<Period>('monthly');
  const [salesPeriod, setSalesPeriod] = useState<Period>('monthly');
  const [profitPeriod, setProfitPeriod] = useState<Period>('monthly');
  const [trendPeriod, setTrendPeriod] = useState<Period>('monthly');
  const [forecastPeriod, setForecastPeriod] = useState<Period>('monthly');

  const {
    liveSummary,
    liveSummaryError,
    isLiveSummaryLoading,
    salesTimeline,
    salesTimelineError,
    isSalesTimelineLoading,
    productTrends,
    productTrendsError,
    isProductTrendsLoading,
    inventoryForecast,
    inventoryForecastError,
    isInventoryForecastLoading,
  } = useAnalyticsData(salesPeriod, trendPeriod, forecastPeriod);

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

      <AnalyticsSummary
        summary={liveSummary}
        error={liveSummaryError}
        isLoading={isLiveSummaryLoading}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="space-y-5">
          <SalesComparisonSection
            salesTimeline={salesTimeline}
            error={salesTimelineError}
            isLoading={isSalesTimelineLoading}
            salesPeriod={salesPeriod}
            onSalesPeriodChange={handleSalesPeriodChange}
          />
        </div>

        <ProfitMarginSection
          salesTimeline={salesTimeline}
          error={salesTimelineError}
          isLoading={isSalesTimelineLoading}
          profitPeriod={profitPeriod}
          onProfitPeriodChange={handleProfitPeriodChange}
        />

        <ProductTrendSection
          productTrends={productTrends}
          error={productTrendsError}
          isLoading={isProductTrendsLoading}
          trendPeriod={trendPeriod}
          onTrendPeriodChange={handleTrendPeriodChange}
        />

        <ForecastSection
          inventoryForecast={inventoryForecast}
          error={inventoryForecastError}
          isLoading={isInventoryForecastLoading}
          forecastPeriod={forecastPeriod}
          onForecastPeriodChange={handleForecastPeriodChange}
        />
      </div>
    </div>
  );
}
