import { useState } from 'react';
import { SurfaceCard } from '../../../shared/components/ui';
import { useAuth } from '../../../app/stores/useAuthStore';
import { useBranches } from '../../users/hooks/useBranches';
import { AnalyticsSummary } from '../components/AnalyticsSummary';
import { BranchComparisonSection } from '../components/BranchComparisonSection';
import { BranchSelect } from '../components/BranchSelect';
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

  /*
   * The one branch choice on this page.
   *
   * `undefined` means "my own branch", which is what a staff account always sends
   * and what head office starts on. The server resolves it — a staff account that
   * sends another branch (or `'all'`) is refused with a 403, so this state can widen
   * nothing on its own. The selector below is rendered only for head office, and it
   * is a convenience, not the control.
   */
  const [branchScope, setBranchScope] = useState<string | undefined>(undefined);

  const { currentUser } = useAuth();
  const isHeadOffice = currentUser?.canViewAllBranches === true;
  // Only head office needs the branch list for a picker. Loaded unconditionally by
  // the hook, but only *used* below when the account may cross branches.
  const { branches } = useBranches();

  const {
    liveSummary,
    liveSummaryError,
    isLiveSummaryLoading,
    salesTimeline,
    salesTimelineError,
    isSalesTimelineLoading,
    profitTimeline,
    profitTimelineError,
    isProfitTimelineLoading,
    productTrends,
    productTrendsError,
    isProductTrendsLoading,
    inventoryForecast,
    inventoryForecastError,
    isInventoryForecastLoading,
    branchComparison,
    branchComparisonError,
    isBranchComparisonLoading,
  } = useAnalyticsData(
    salesPeriod,
    profitPeriod,
    trendPeriod,
    forecastPeriod,
    branchScope,
    isHeadOffice,
  );

  const applyGlobalPeriod = (nextPeriod: Period) => {
    setGlobalPeriod(nextPeriod);
    setSalesPeriod(nextPeriod);
    setProfitPeriod(nextPeriod);
    setTrendPeriod(nextPeriod);
    setForecastPeriod(nextPeriod);
  };

  const handleSalesPeriodChange = (nextPeriod: Period) => setSalesPeriod(nextPeriod);
  const handleProfitPeriodChange = (nextPeriod: Period) => setProfitPeriod(nextPeriod);
  const handleTrendPeriodChange = (nextPeriod: Period) => setTrendPeriod(nextPeriod);
  const handleForecastPeriodChange = (nextPeriod: Period) => setForecastPeriod(nextPeriod);

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <SurfaceCard className="flex flex-col gap-2 p-3 md:flex-row md:items-center">
          <div className="flex items-center gap-2 px-1 text-2xs font-bold text-app-text-muted dark:text-zinc-500">Global Sort</div>
          <PeriodSelector value={globalPeriod} onChange={applyGlobalPeriod} prefix="global" />
          {/*
            The branch selector lives beside the period selector and appears for head
            office only. Staff see the row exactly as before — no new control, and no
            hint that another branch's numbers are a thing a control could reach.
          */}
          {isHeadOffice && (
            <div className="flex items-center gap-2 md:ml-2 md:border-l md:pl-3">
              <div className="flex items-center gap-2 px-1 text-2xs font-bold text-app-text-muted dark:text-zinc-500">Branch</div>
              <BranchSelect
                value={branchScope}
                onChange={setBranchScope}
                branches={branches}
                ownBranchId={currentUser?.branchId ?? null}
              />
            </div>
          )}
        </SurfaceCard>
      </div>

      <AnalyticsSummary
        summary={liveSummary}
        error={liveSummaryError}
        isLoading={isLiveSummaryLoading}
      />

      {isHeadOffice && (
        <BranchComparisonSection
          comparison={branchComparison}
          error={branchComparisonError}
          isLoading={isBranchComparisonLoading}
        />
      )}

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
          profitTimeline={profitTimeline}
          error={profitTimelineError}
          isLoading={isProfitTimelineLoading}
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
