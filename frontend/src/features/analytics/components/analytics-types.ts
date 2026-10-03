import type { AnalyticsBucket, InsightRequest } from '../api/analyticsApi';
import { analyticsApi } from '../api/analyticsApi';
import { describeApiError } from '../../../shared/api/errors';

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
  border: '1px solid var(--app-border-hairline)',
  borderRadius: '14px',
  fontSize: '12px',
  background: 'var(--app-surface-raised)',
};

/**
 * The one place a chart colour is written down.
 *
 * Recharts paints its lines, bars and axis labels as SVG attributes, and an SVG
 * attribute cannot read a CSS variable the way a div's `background` can — so
 * these are literal values rather than tokens, and they have to live somewhere.
 * That place is here, not typed out at each `<Line>`/`<Bar>`/`<XAxis>`.
 *
 * `getChartColors()` is a FUNCTION on purpose. Today it simply returns the
 * palette below, which is enough to remove the duplication. When the charts
 * need to follow a theme change live, swap this body for the real token read
 * (`getComputedStyle`) — every call site keeps working, because they already ask
 * for the colours rather than importing frozen strings. That is the migration
 * path from "written once" to "actually theme-driven".
 */
export interface ChartColors {
  /** Neutral series — the "actual" / "revenue" / first-timeline line. */
  neutral: string;
  /** Positive series — success green. */
  positive: string;
  /** Secondary series — violet, for a second comparison line. */
  secondary: string;
  /** Axis tick labels. */
  axis: string;
}

export function getChartColors(): ChartColors {
  return {
    neutral: '#555558', // --app-text-muted (light)
    positive: '#34c759', // --app-success
    secondary: '#af52de', // --app-violet
    axis: '#86868B',
  };
}

export type InsightReport = {
  overview: string;
  keyFindings: [string, string, string];
  riskWatchout: string;
  recommendedAction: string;
  confidence: number;
};

export type InsightState = {
  isLoading: boolean;
  report: InsightReport | null;
  lastGeneratedAt: string | null;
  /**
   * A sentence to show when the last attempt failed, or `null` when it did not.
   *
   * Held in state rather than thrown so the section keeps rendering: a manager
   * whose AI report is unavailable should still see the chart and the tiles
   * behind it, with one line explaining what happened.
   */
  error: string | null;
};

export const createEmptyInsightState = (): InsightState => ({
  isLoading: false,
  report: null,
  lastGeneratedAt: null,
  error: null,
});

export const formatInsightTime = (timestamp: string | null) => {
  if (!timestamp) return 'Not generated yet';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * Ask the backend for an insight report and return it.
 *
 * ### What changed, and why
 *
 * This function used to fabricate the report in the browser: it interpolated the
 * figures it was handed into fixed sentence templates, with a `sleep(240)` to
 * imitate latency, and never left the page. So "AI-assisted insights" was a
 * label rather than a capability, and the paper's §3.4 — which names Gemini and
 * describes the numbers being sent as "tailored prompts" — described something
 * that did not exist.
 *
 * It now posts those figures to `/analytics/insights`, which holds the API key
 * and calls Gemini. The key is deliberately **not** here: anything in this bundle
 * is readable by anyone who opens developer tools.
 *
 * ### Why this only sends aggregate figures
 *
 * The Gemini free tier may use submitted prompts to improve Google's products,
 * with human review. Under the project's decision **B3**, only figures the system
 * has already computed may leave it — never a customer name, a raw transaction
 * row, or an identifier. `InsightRequest` is a closed union for that reason, so
 * a caller cannot add a field to the payload without a type error.
 *
 * A failure is left to propagate: the panel shows it inline rather than this
 * function inventing a fallback report, because a fabricated insight attributed
 * to the AI would be worse than an honest error.
 */
export async function generateInsight(context: InsightRequest): Promise<InsightReport> {
  return analyticsApi.insight(context);
}

/**
 * Runs one insight request and folds the outcome back into `InsightState`.
 *
 * Shared by the four sections because they differ only in which figures they
 * send — the loading flag, the error handling, the timestamp and the report all
 * behave identically, and four copies of that is four places for the error path
 * to be forgotten in.
 *
 * ### Why the failure is stored rather than thrown
 *
 * `generateInsight` rejects on a 503 (no key, or the whole model chain out of
 * quota). Letting that escape would leave the section stuck on `isLoading` with
 * an unhandled rejection, and the chart behind it would have no reason to
 * disappear. So it is caught here, turned into a sentence for a person, and put
 * in state for the panel to show.
 *
 * The message comes from the server where it has one: `describeApiError` prefers
 * the server's own words for a 4xx/5xx and only falls back to the generic
 * "try again" when there is nothing better. Either way the report is **not**
 * replaced by an invented one — a fabricated insight attributed to the AI would
 * be worse than an honest error.
 */
export async function runInsightRequest(
  context: InsightRequest,
  setState: (updater: (previous: InsightState) => InsightState) => void,
): Promise<void> {
  setState((previous) => ({ ...previous, isLoading: true, error: null }));
  try {
    const report = await generateInsight(context);
    setState((previous) => ({
      ...previous,
      isLoading: false,
      report,
      lastGeneratedAt: new Date().toISOString(),
      error: null,
    }));
  } catch (error) {
    setState((previous) => ({
      ...previous,
      isLoading: false,
      error: describeApiError(error, 'The insight report could not be generated.'),
    }));
  }
}
