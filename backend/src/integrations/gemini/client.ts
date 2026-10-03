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
 * On a **quota** response (HTTP 429, or a 5xx — the model is there but
 * unavailable) the next model in the chain is tried. On any **other** error the
 * chain stops and the error surfaces: a malformed request, a bad key or a
 * content refusal will be answered identically by every model, so retrying it
 * down the list spends three requests to collect three copies of the same
 * failure. That distinction is the whole behaviour worth testing.
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

  /** The last quota/availability failure, surfaced if the chain runs out. */
  let lastFailure: { status: number; model: string } | null = null;

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

    // Quota exhaustion or a model that is temporarily unavailable — try the next.
    if (response.status === 429 || response.status >= 500) {
      lastFailure = { status: response.status, model };
      logger.warn('Gemini model unavailable, trying the next in the chain', {
        model,
        status: response.status,
      });
      continue;
    }

    /*
     * Anything else — 400 (malformed request), 401/403 (bad or unauthorised key),
     * 404 (the model does not exist). Every remaining model would answer the same
     * way, so the chain stops here and the failure is reported as itself.
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

  logger.error('Gemini quota exhausted across every configured model', {
    models: models.join(', '),
    lastStatus: lastFailure?.status ?? null,
  });
  throw new GeminiUnavailableError(
    'all_models_failed',
    'The AI service is temporarily unavailable.',
  );
}
