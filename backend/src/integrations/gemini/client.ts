import { env } from '../../config/env.js';
import { logger } from '../../shared/logger.js';
import { DEFAULT_GEMINI_MODELS, resolveGeminiModels } from './models.js';

/**
 * A thin caller for the Gemini `generateContent` API.
 *
 * ### Why there is no SDK here
 *
 * The backend's dependency list is deliberately short — `express`, `zod`,
 * `@supabase/supabase-js`, `helmet`, `cors`, `image-size`, `dotenv` — and every
 * entry is something the team has decided to be answerable for. The Gemini SDK
 * would be a large dependency to audit for one POST request. A `fetch` wrapper
 * does the same job, has no version to track, and keeps the network surface
 * visible in one file. `fetch` is built into the Node runtime the Dockerfile
 * pins, so this costs nothing at install time.
 *
 * ### The key
 *
 * Read from `env` in this file and nowhere else. It is never logged, never
 * included in an error message, and never returned to a caller — the response
 * bodies below are built from Gemini's own text, not from the request.
 *
 * ### What "failover" means, precisely
 *
 * On a response that says **this model** is the problem — a quota failure (429),
 * a retired or unknown model (404), or a model that is momentarily unavailable
 * (5xx) — the next model in the chain is tried.
 *
 * On any other error the chain stops and the error surfaces: a malformed request
 * (400), or a bad or unauthorised key (401/403), will be answered identically by
 * every model, so retrying it down the list spends three requests to collect
 * three copies of the same failure. That distinction is the whole behaviour worth
 * testing.
 *
 * ### Why 404 falls through rather than stopping
 *
 * 404 is the one status that is **per-model**: it means this model id does not
 * exist. Google retires models on its own schedule — it shut down the whole 2.0
 * family while this feature was being built, and `gemini-2.0-flash` now answers
 * 404 against the live API. A chain containing a retired model is therefore a
 * normal state of affairs, not a misconfiguration, and halting the entire chain
 * because one link is gone would defeat the only reason the chain exists.
 *
 * Attempts are **sequential and bounded** — one model at a time, at most
 * `models.length` attempts. Fanning out to every model at once would multiply
 * quota usage at exactly the moment quota is the problem.
 */

/** The shape of a Gemini `generateContent` response, reduced to what is used. */
interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

export interface GeminiCallOptions {
  /** The full prompt. Built by `insight.service.ts` under the B3 data rule. */
  prompt: string;
  /** Ask Gemini for `application/json` rather than prose. */
  responseSchema?: Record<string, unknown>;
  /**
   * Injected for testing. Defaults to the runtime `fetch`; a test passes a stub
   * so the failover logic can be exercised without a network or an API key —
   * the same reason `shouldSkipRateLimit` is exported for its own test.
   */
  fetchImpl?: typeof fetch;
  /** Injected for testing; defaults to the `GEMINI_MODELS` environment value. */
  models?: readonly string[];
  /** Injected for testing; defaults to `env.GEMINI_API_KEY`. */
  apiKey?: string;
}

/** Raised when every model in the chain was unavailable, or none is configured. */
export class GeminiUnavailableError extends Error {
  readonly reason: 'not_configured' | 'all_models_failed';

  constructor(reason: 'not_configured' | 'all_models_failed', message: string) {
    super(message);
    this.name = 'GeminiUnavailableError';
    this.reason = reason;
  }
}

/** The endpoint for one model. The key goes in a header, never the URL. */
function endpointFor(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
}

/**
 * Pull the model's text out of a `generateContent` response.
 *
 * Returns `null` when the response carries no usable text — a prompt blocked by
 * a safety filter, or a candidate that finished without producing parts. Both are
 * real outcomes that must surface as "the model did not answer" rather than as an
 * empty string treated as a report.
 */
function extractText(payload: GeminiResponse): string | null {
  const blocked = payload.promptFeedback?.blockReason;
  if (blocked) return null;
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map((part) => part.text ?? '')
    .join('')
    .trim();
  return text.length > 0 ? text : null;
}

/**
 * Ask Gemini, falling through the model chain on quota exhaustion.
 *
 * @returns the model's raw text. Parsing it into an `InsightReport` is the
 *          service's job, not this one's.
 * @throws  `GeminiUnavailableError` when no key is configured, or when every
 *          model in the chain was unavailable for a quota/availability reason.
 *          Other errors propagate unchanged so the route can report them
 *          accurately.
 */
export async function generateGeminiContent(options: GeminiCallOptions): Promise<string> {
  const apiKey = options.apiKey ?? env.GEMINI_API_KEY;

  /*
   * No key configured. This is a deployment state, not a caller error, and it is
   * reported as its own reason so the route can answer 503 AI_NOT_CONFIGURED
   * rather than a generic failure — a message that tells an operator exactly
   * what to set.
   */
  if (!apiKey) {
    throw new GeminiUnavailableError(
      'not_configured',
      'The AI service is not configured for this environment.',
    );
  }

  const doFetch = options.fetchImpl ?? fetch;
  const models = options.models ?? resolveGeminiModels(env.GEMINI_MODELS ?? DEFAULT_GEMINI_MODELS.join(','));

  /**
   * Every per-model failure, in order, surfaced in the log if the chain runs out.
   *
   * The whole list rather than only the last one, because the useful diagnostic
   * question is "what did *each* model say?" — a chain that answered 404, 404,
   * 404 is a naming or configuration problem, while 429, 429, 429 is a busy day,
   * and the two need different responses from whoever reads the log.
   */
  const failures: Array<{ model: string; status: number }> = [];

  for (const model of models) {
    const response = await doFetch(endpointFor(model), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Header, not query string: a key in a URL ends up in logs and referrers.
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: options.prompt }] }],
        ...(options.responseSchema
          ? {
              generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: options.responseSchema,
              },
            }
          : {}),
      }),
    });

    if (response.ok) {
      const payload = (await response.json()) as GeminiResponse;
      const text = extractText(payload);
      if (text) return text;

      /*
       * The call succeeded but produced nothing usable — a safety block or an
       * empty candidate. Trying the next model will not change a content
       * refusal, so this stops rather than burning the rest of the chain.
       */
      throw new GeminiUnavailableError(
        'all_models_failed',
        'The AI service returned no usable response.',
      );
    }

    /*
     * 429 quota, 404 retired/unknown model, 5xx momentarily unavailable — all
     * three say "this model is the problem", so the next one is tried. See the
     * header note on why 404 belongs here and not with the fatal statuses.
     */
    if (response.status === 429 || response.status === 404 || response.status >= 500) {
      failures.push({ model, status: response.status });
      logger.warn('Gemini model unavailable, trying the next in the chain', {
        model,
        status: response.status,
      });
      continue;
    }

    /*
     * Anything else — 400 (malformed request), 401/403 (bad or unauthorised key).
     * Every remaining model would answer the same way, so the chain stops here
     * and the failure is reported as itself.
     *
     * The response body is deliberately not included: on a 403 it can echo
     * request details, and the status plus the model name is what an operator
     * needs.
     */
    logger.error('Gemini request failed', { model, status: response.status });
    throw new GeminiUnavailableError(
      'all_models_failed',
      `The AI service rejected the request (status ${response.status}).`,
    );
  }

  logger.error('Every configured Gemini model was unavailable', {
    attempts: failures.map((failure) => `${failure.model}:${failure.status}`).join(', '),
    // A chain where every model answered 404 is a naming/configuration problem
    // rather than an outage, and the log should let a reader tell the difference.
    allRetired: failures.length > 0 && failures.every((failure) => failure.status === 404),
  });
  throw new GeminiUnavailableError(
    'all_models_failed',
    'The AI service is temporarily unavailable.',
  );
}
