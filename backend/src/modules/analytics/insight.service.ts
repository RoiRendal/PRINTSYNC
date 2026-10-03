import { AppError } from '../../shared/errors.js';
import { generateGeminiContent, GeminiUnavailableError } from '../../integrations/gemini/client.js';

/**
 * Turns statistics the system has **already computed** into a short written
 * interpretation, using Gemini.
 *
 * ### The division of labour (the paper's, not a preference)
 *
 * §3.4 is explicit that the maths stays in the system — "an internal forecast of
 * demand and calculations of trends … performed through the use of a regression
 * analysis algorithm implemented in the system" — and that "the use of the AI is
 * **purely interpretive**". So this module never asks Gemini to calculate
 * anything. It is handed finished numbers and asked for prose. A model that
 * invented a figure would be a bug, not a feature, which is why the prompt below
 * forbids it in as many words.
 *
 * ### The B3 data rule — read this before adding a field
 *
 * The project uses the Gemini **free tier**, whose terms state that submitted
 * prompts and responses may be used to improve Google's products and may be read
 * by human reviewers. The rule adopted in response (decision **B3**) is that
 * **only derived aggregates leave the system** — never anything that identifies a
 * person or a customer.
 *
 * **May be sent:** computed totals and averages; product *names* as they appear in
 * the catalogue; date or period *labels*; derived figures (growth %, deltas).
 *
 * **Must never be sent:** customer names or contacts, raw transaction or order
 * rows, any `*_id` UUID, email addresses, user-typed free text (order notes,
 * remarks, addresses), or anything from `audit_logs`.
 *
 * The types below are the enforcement mechanism. `InsightContext` is a **narrow,
 * explicitly-typed object with no free-text or identifier field** — it cannot
 * hold a customer name, so one cannot leak in by spreading a database row into
 * it later. That is the same defensive shape as `AnalyticsSummary`, which is
 * purpose-built rather than a table dump, and the reason a caller must map
 * fields by hand rather than pass a row through.
 */

/** The four analytics sections that offer an insight report. */
export type InsightFeature = 'sales' | 'profit' | 'trend' | 'forecast';

/**
 * The report shape the frontend already renders.
 *
 * Unchanged from the client-side template it replaces, so the UI needs no
 * contract change — `keyFindings` is a fixed three, because the panel renders it
 * as a three-item list and a variable length would silently reflow the card.
 */
export interface InsightReport {
  overview: string;
  keyFindings: [string, string, string];
  riskWatchout: string;
  recommendedAction: string;
  confidence: number;
}

/**
 * The numbers one section may send, per the B3 rule above.
 *
 * Every field here is a figure or a catalogue label the backend computed. There
 * is deliberately no `customer`, no `notes`, no `id`, and no open
 * `Record<string, unknown>` — an index signature would defeat the whole purpose,
 * because it would let a caller pass a raw row and have it type-check.
 */
export type InsightContext =
  | {
      feature: 'sales';
      totalA: number;
      totalB: number;
      growth: number;
      selectionA: string;
      selectionB: string;
    }
  | {
      feature: 'profit';
      avgMargin: number;
      totalProfit: number;
      totalRevenue: number;
      bestLabel: string;
      lowestLabel: string;
    }
  | {
      feature: 'trend';
      totalUnits: number;
      leadingProduct: string;
      leadingUnits: number;
      lowestProduct: string;
    }
  | {
      feature: 'forecast';
      metric: string;
      actual: number;
      forecast: number;
      expectedGrowth: number;
      forecastConfidence: number;
    };

/**
 * The JSON schema Gemini must answer with.
 *
 * Sent as `responseSchema` so the model is constrained to the report shape rather
 * than asked politely for it. Requesting structured output is more reliable than
 * parsing prose, and it means a malformed answer is a schema violation the API
 * catches rather than something this code has to guess at.
 */
const REPORT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    overview: { type: 'string' },
    keyFindings: { type: 'array', items: { type: 'string' } },
    riskWatchout: { type: 'string' },
    recommendedAction: { type: 'string' },
    confidence: { type: 'number' },
  },
  required: ['overview', 'keyFindings', 'riskWatchout', 'recommendedAction', 'confidence'],
};

/** One sentence per feature, naming the role the reader should adopt. */
const FEATURE_BRIEF: Record<InsightFeature, string> = {
  sales: 'You are interpreting a comparison of two sales periods for a small print shop.',
  profit: 'You are interpreting a profit-margin breakdown for a small print shop.',
  trend: 'You are interpreting a product-demand breakdown for a small print shop.',
  forecast: 'You are interpreting a financial forecast for a small print shop.',
};

/**
 * Build the prompt.
 *
 * Kept separate from the call so it can be asserted on directly in a test — the
 * B3 rule is a promise about what leaves the machine, and a promise worth making
 * is one worth checking.
 *
 * The numeric context is serialised rather than written into sentences so the
 * exact set of fields that leave the system is visible in one place: it is
 * whatever `InsightContext` holds, and nothing else.
 */
export function buildInsightPrompt(context: InsightContext): string {
  const { feature, ...figures } = context;

  return [
    FEATURE_BRIEF[feature],
    '',
    'Below are figures that have ALREADY been calculated by the system. Use only',
    'these numbers. Do not perform your own calculations and do not introduce any',
    'figure that is not listed — if something is not present, do not mention it.',
    '',
    JSON.stringify(figures, null, 2),
    '',
    'Write a short, plain-language interpretation a shop manager can act on.',
    'Avoid jargon, avoid restating every number, and never invent context about',
    'customers or the market that is not in the figures above.',
    '',
    'Provide: an "overview" of one or two sentences; exactly three "keyFindings"',
    'as short bullet strings; one "riskWatchout"; one "recommendedAction"; and a',
    '"confidence" between 0 and 100 reflecting how clear the figures are.',
  ].join('\n');
}

/** Narrow, hand-checked validation — a model's output is untrusted input. */
function parseReport(raw: string): InsightReport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppError(502, 'AI_RESPONSE_INVALID', 'The AI service returned an unreadable report.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new AppError(502, 'AI_RESPONSE_INVALID', 'The AI service returned an unreadable report.');
  }

  const candidate = parsed as Record<string, unknown>;
  const overview = candidate.overview;
  const findings = candidate.keyFindings;
  const riskWatchout = candidate.riskWatchout;
  const recommendedAction = candidate.recommendedAction;
  const confidence = candidate.confidence;

  const isNonEmptyString = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0;

  /*
   * Every field is checked, including the ones that "cannot" be wrong. The
   * response schema constrains a cooperative model, but the schema is a request,
   * not a guarantee — and a partially-formed report rendered into the panel
   * would show `undefined` to a manager rather than an honest failure.
   */
  if (
    !isNonEmptyString(overview) ||
    !isNonEmptyString(riskWatchout) ||
    !isNonEmptyString(recommendedAction) ||
    !Array.isArray(findings) ||
    findings.length < 3 ||
    !findings.slice(0, 3).every(isNonEmptyString) ||
    typeof confidence !== 'number' ||
    !Number.isFinite(confidence)
  ) {
    throw new AppError(502, 'AI_RESPONSE_INVALID', 'The AI service returned an incomplete report.');
  }

  /*
   * `findings` is narrowed by the guard above, but its elements are still typed
   * `unknown` — so they are re-read through the same predicate rather than cast.
   */
  const [first, second, third] = findings as unknown[];
  if (!isNonEmptyString(first) || !isNonEmptyString(second) || !isNonEmptyString(third)) {
    throw new AppError(502, 'AI_RESPONSE_INVALID', 'The AI service returned an incomplete report.');
  }

  return {
    overview: overview.trim(),
    // Exactly three, matching the panel's list — extra items are dropped rather
    // than overflowing a card laid out for three.
    keyFindings: [first.trim(), second.trim(), third.trim()],
    riskWatchout: riskWatchout.trim(),
    recommendedAction: recommendedAction.trim(),
    confidence: Math.max(0, Math.min(100, confidence)),
  };
}

/**
 * Generate one insight report.
 *
 * `deps` is injected so the failover and parsing behaviour can be tested without
 * a network or a key, mirroring how the rate limiter's predicate is exported for
 * its own test.
 */
export async function generateInsightReport(
  context: InsightContext,
  deps: { generate?: typeof generateGeminiContent } = {},
): Promise<InsightReport> {
  const generate = deps.generate ?? generateGeminiContent;

  try {
    const raw = await generate({
      prompt: buildInsightPrompt(context),
      responseSchema: REPORT_SCHEMA,
    });
    return parseReport(raw);
  } catch (error) {
    /*
     * A missing key is a configuration state, not a service outage, and it reads
     * differently to whoever has to fix it — so it keeps its own code while both
     * answer 503.
     */
    if (error instanceof GeminiUnavailableError) {
      if (error.reason === 'not_configured') {
        throw new AppError(
          503,
          'AI_NOT_CONFIGURED',
          'AI insights are not configured for this environment.',
        );
      }
      throw new AppError(503, 'AI_SERVICE_UNAVAILABLE', 'AI insights are temporarily unavailable.');
    }
    throw error;
  }
}
