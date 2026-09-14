import { useEffect, useMemo, useState } from 'react';
import {
  analyticsApi,
  type AnalyticsSummary,
  type InventoryForecast,
  type ProductTrends,
  type SalesTimeline,
} from '../api/analyticsApi';
import { ApiError } from '../../../shared/api/errors';
import { periodToBucket, periodToHorizonDays, type Period } from '../components/analytics-types';

export interface AnalyticsDataState {
  dateRange: { from: string; to: string };
  liveSummary: AnalyticsSummary | null;
  liveSummaryError: string | null;
  isLiveSummaryLoading: boolean;
  salesTimeline: SalesTimeline | null;
  salesTimelineError: string | null;
  isSalesTimelineLoading: boolean;
  productTrends: ProductTrends | null;
  productTrendsError: string | null;
  isProductTrendsLoading: boolean;
  inventoryForecast: InventoryForecast | null;
  inventoryForecastError: string | null;
  isInventoryForecastLoading: boolean;
}

export function useAnalyticsData(
  salesPeriod: Period,
  trendPeriod: Period,
  forecastPeriod: Period,
): AnalyticsDataState {
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

  return {
    dateRange,
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
  };
}
