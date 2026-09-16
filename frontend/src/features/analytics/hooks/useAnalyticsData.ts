import { useEffect, useMemo, useRef, useState } from 'react';
import {
  analyticsApi,
  type AnalyticsSummary,
  type InventoryForecast,
  type ProductTrends,
  type SalesTimeline,
} from '../api/analyticsApi';
import { ApiError } from '../../../shared/api/errors';
import {
  includesAnyDomain,
  subscribeToDataChanges,
  type DataDomain,
} from '../../../shared/store/dataEvents';
import { periodToBucket, periodToHorizonDays, type Period } from '../components/analytics-types';

/**
 * Domains that can move a number on this page. Analytics is fully derived from
 * the operational tables, so any of them changing invalidates all five panels.
 */
const ANALYTICS_DOMAINS: readonly DataDomain[] = [
  'orders',
  'inventory',
  'payments',
  'customers',
  'designs',
  'settings',
];

/**
 * One user action can announce several domains in quick succession (a POS sale
 * touches payments and inventory; saving an order touches orders and
 * inventory). Coalescing them into a single reload keeps one action from firing
 * five parallel dashboard queries twice over.
 */
const RELOAD_DEBOUNCE_MS = 400;

export interface AnalyticsDataState {
  dateRange: { from: string; to: string };
  liveSummary: AnalyticsSummary | null;
  liveSummaryError: string | null;
  isLiveSummaryLoading: boolean;
  salesTimeline: SalesTimeline | null;
  salesTimelineError: string | null;
  isSalesTimelineLoading: boolean;
  profitTimeline: SalesTimeline | null;
  profitTimelineError: string | null;
  isProfitTimelineLoading: boolean;
  productTrends: ProductTrends | null;
  productTrendsError: string | null;
  isProductTrendsLoading: boolean;
  inventoryForecast: InventoryForecast | null;
  inventoryForecastError: string | null;
  isInventoryForecastLoading: boolean;
}

export function useAnalyticsData(
  salesPeriod: Period,
  profitPeriod: Period,
  trendPeriod: Period,
  forecastPeriod: Period,
): AnalyticsDataState {
  const [liveSummary, setLiveSummary] = useState<AnalyticsSummary | null>(null);
  const [liveSummaryError, setLiveSummaryError] = useState<string | null>(null);
  const [isLiveSummaryLoading, setIsLiveSummaryLoading] = useState(true);
  const [salesTimeline, setSalesTimeline] = useState<SalesTimeline | null>(null);
  const [salesTimelineError, setSalesTimelineError] = useState<string | null>(null);
  const [isSalesTimelineLoading, setIsSalesTimelineLoading] = useState(true);
  const [profitTimeline, setProfitTimeline] = useState<SalesTimeline | null>(null);
  const [profitTimelineError, setProfitTimelineError] = useState<string | null>(null);
  const [isProfitTimelineLoading, setIsProfitTimelineLoading] = useState(true);
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

  /*
   * Bumping this token re-runs all five fetches below.
   *
   * The panels are mounted for as long as the admin stays on the page, so
   * without a trigger they would keep rendering whatever the numbers were at
   * mount time. Previously the only way to refresh them was to navigate away
   * and back — which is exactly the "restart the page" behaviour we are
   * removing.
   */
  const [reloadToken, setReloadToken] = useState(0);
  const reloadTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const cancelPendingReload = () => {
      if (reloadTimerRef.current !== null) {
        window.clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
    };

    const unsubscribe = subscribeToDataChanges((domains) => {
      if (!includesAnyDomain(domains, ANALYTICS_DOMAINS)) return;
      cancelPendingReload();
      reloadTimerRef.current = window.setTimeout(() => {
        reloadTimerRef.current = null;
        setReloadToken((token) => token + 1);
      }, RELOAD_DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      cancelPendingReload();
    };
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
  }, [dateRange.from, dateRange.to, reloadToken]);

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
  }, [dateRange.from, dateRange.to, salesPeriod, reloadToken]);

  useEffect(() => {
    let mounted = true;
    setIsProfitTimelineLoading(true);
    void analyticsApi.salesTimeline(dateRange.from, dateRange.to, periodToBucket[profitPeriod])
      .then((data) => {
        if (mounted) {
          setProfitTimeline(data);
          setProfitTimelineError(null);
        }
      })
      .catch((error: unknown) => {
        if (mounted) setProfitTimelineError(error instanceof ApiError ? error.message : 'Profit timeline could not be loaded.');
      })
      .finally(() => {
        if (mounted) setIsProfitTimelineLoading(false);
      });
    return () => { mounted = false; };
  }, [dateRange.from, dateRange.to, profitPeriod, reloadToken]);

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
  }, [dateRange.from, dateRange.to, trendPeriod, reloadToken]);

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
  }, [dateRange.from, dateRange.to, forecastPeriod, reloadToken]);

  return {
    dateRange,
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
  };
}
