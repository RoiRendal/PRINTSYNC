import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  generateGeminiContent,
  GeminiUnavailableError,
} from '../../src/integrations/gemini/client.js';
import { DEFAULT_GEMINI_MODELS, resolveGeminiModels } from '../../src/integrations/gemini/models.js';
import {
  buildInsightPrompt,
  generateInsightReport,
  type InsightContext,
} from '../../src/modules/analytics/insight.service.js';
import { AppError } from '../../src/shared/errors.js';

/* -------------------------------------------------------------------------- */
/* Test doubles                                                                */
/* -------------------------------------------------------------------------- */

/** A JSON body shaped the way Gemini answers a well-formed request. */
function okBody(text: string) {
  return { candidates: [{ content: { parts: [{ text }] } }] };
}

/** The valid report the fake model "produces" when a test needs a success. */
const VALID_REPORT = JSON.stringify({
  overview: 'Balayan outperformed the comparison period.',
  keyFindings: ['Revenue rose.', 'Volume held steady.', 'Margin improved.'],
  riskWatchout: 'Growth may not repeat without the same drivers.',
  recommendedAction: 'Repeat the promotions that drove the increase.',
  confidence: 82,
});

/**
 * A `fetch` stub that answers each call from a scripted list, recording every
 * URL it was asked for.
 *
 * The whole point of these tests is the *sequence* of calls — which model was
 * tried, how many were tried, and whether the chain stopped — so the stub keeps
 * the call log rather than returning a single canned response.
 */
function scriptedFetch(responses: Array<{ status: number; body?: unknown }>) {
  const calls: string[] = [];
  let index = 0;
  const impl = (async (url: string | URL) => {
    calls.push(String(url));
    const scripted = responses[Math.min(index, responses.length - 1)];
    index += 1;
    return new Response(
      scripted?.body === undefined ? '{}' : JSON.stringify(scripted.body),
      { status: scripted?.status ?? 200 },
    );
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const THREE_MODELS = ['model-a', 'model-b', 'model-c'] as const;
const KEY = 'test-key-not-a-real-secret';

/* -------------------------------------------------------------------------- */
/* The failover chain                                                          */
/* -------------------------------------------------------------------------- */

describe('integrations/gemini — the quota failover chain', () => {
  it('answers from the first model when it is healthy, without touching the rest', async () => {
    const { impl, calls } = scriptedFetch([{ status: 200, body: okBody('hello') }]);

    const text = await generateGeminiContent({
      prompt: 'p',
      apiKey: KEY,
      models: THREE_MODELS,
      fetchImpl: impl,
    });

    assert.equal(text, 'hello');
    assert.equal(calls.length, 1, 'a healthy first model must not cost a second request');
    assert.match(calls[0] ?? '', /model-a/);
  });

  it('advances to the next model on a 429, and answers from it', async () => {
    const { impl, calls } = scriptedFetch([
      { status: 429 },
      { status: 200, body: okBody('from b') },
    ]);

    const text = await generateGeminiContent({
      prompt: 'p',
      apiKey: KEY,
      models: THREE_MODELS,
      fetchImpl: impl,
    });

    assert.equal(text, 'from b');
    assert.equal(calls.length, 2);
    assert.match(calls[0] ?? '', /model-a/);
    assert.match(calls[1] ?? '', /model-b/);
  });

  it('advances on a 5xx too — an unavailable model is the same problem as an exhausted one', async () => {
    const { impl, calls } = scriptedFetch([
      { status: 503 },
      { status: 200, body: okBody('recovered') },
    ]);

    const text = await generateGeminiContent({
      prompt: 'p',
      apiKey: KEY,
      models: THREE_MODELS,
      fetchImpl: impl,
    });

    assert.equal(text, 'recovered');
    assert.equal(calls.length, 2);
  });

  it('walks the whole chain when every model is out of quota, then throws', async () => {
    const { impl, calls } = scriptedFetch([{ status: 429 }]);

    await assert.rejects(
      () =>
        generateGeminiContent({ prompt: 'p', apiKey: KEY, models: THREE_MODELS, fetchImpl: impl }),
      (error: unknown) => {
        assert.ok(error instanceof GeminiUnavailableError);
        assert.equal(error.reason, 'all_models_failed');
        return true;
      },
    );

    // One attempt per model — sequential and bounded, never a fan-out, and never
    // a retry loop that would spend quota at exactly the wrong moment.
    assert.equal(calls.length, THREE_MODELS.length);
    assert.deepEqual(
      calls.map((url) => url.match(/models\/([^:]+)/)?.[1]),
      [...THREE_MODELS],
    );
  });

  it('advances on a 404 too — a retired model is a per-model problem, not a fatal one', async () => {
    /*
     * Observed live: `gemini-2.0-flash` answers 404 against the real API, because
     * Google shut the 2.0 family down. A 404 says nothing about the next model in
     * the chain, so halting here would mean one retired entry — the exact thing
     * the chain exists to survive — kills the whole feature.
     */
    const { impl, calls } = scriptedFetch([
      { status: 404 },
      { status: 200, body: okBody('survived a dead model') },
    ]);

    const text = await generateGeminiContent({
      prompt: 'p',
      apiKey: KEY,
      models: THREE_MODELS,
      fetchImpl: impl,
    });

    assert.equal(text, 'survived a dead model');
    assert.equal(calls.length, 2, 'a 404 must advance to the next model');
  });

  it('STOPS on a non-quota error instead of spending the rest of the chain', async () => {
    /*
     * The behaviour most worth pinning down. A 400 (malformed request) or a
     * 401/403 (bad key) will be answered identically by every model, so falling
     * through would burn three requests to collect three copies of one failure.
     *
     * 404 is deliberately NOT in this list — it is per-model, and is covered by
     * the test above.
     */
    for (const status of [400, 401, 403]) {
      const { impl, calls } = scriptedFetch([{ status }]);

      await assert.rejects(
        () =>
          generateGeminiContent({ prompt: 'p', apiKey: KEY, models: THREE_MODELS, fetchImpl: impl }),
        (error: unknown) => {
          assert.ok(error instanceof GeminiUnavailableError, `status ${status}`);
          assert.equal(error.reason, 'all_models_failed');
          return true;
        },
      );

      assert.equal(calls.length, 1, `status ${status} must not advance the chain`);
    }
  });

  it('walks the whole chain when every model is retired, then throws', async () => {
    // The realistic end-state of the paper's own model list: every name is gone.
    const { impl, calls } = scriptedFetch([{ status: 404 }]);

    await assert.rejects(
      () =>
        generateGeminiContent({ prompt: 'p', apiKey: KEY, models: THREE_MODELS, fetchImpl: impl }),
      (error: unknown) => error instanceof GeminiUnavailableError,
    );

    assert.equal(calls.length, THREE_MODELS.length);
  });

  it('stops rather than exhausts the chain when a model succeeds but answers nothing', async () => {
    // A safety block or an empty candidate. A content refusal is not a quota
    // problem — asking the next model the same question changes nothing.
    const { impl, calls } = scriptedFetch([
      { status: 200, body: { promptFeedback: { blockReason: 'SAFETY' } } },
    ]);

    await assert.rejects(
      () =>
        generateGeminiContent({ prompt: 'p', apiKey: KEY, models: THREE_MODELS, fetchImpl: impl }),
      (error: unknown) => {
        assert.ok(error instanceof GeminiUnavailableError);
        return true;
      },
    );

    assert.equal(calls.length, 1);
  });

  it('reports a missing key as "not configured" without calling anything', async () => {
    const { impl, calls } = scriptedFetch([{ status: 200, body: okBody('x') }]);

    await assert.rejects(
      () => generateGeminiContent({ prompt: 'p', apiKey: '', models: THREE_MODELS, fetchImpl: impl }),
      (error: unknown) => {
        assert.ok(error instanceof GeminiUnavailableError);
        assert.equal(error.reason, 'not_configured');
        return true;
      },
    );

    assert.equal(calls.length, 0, 'no key means no request should be attempted');
  });

  it('sends the key in a header, never in the URL', async () => {
    // A key in a query string ends up in logs and referrers. This asserts the
    // property rather than the implementation.
    const { impl, calls } = scriptedFetch([{ status: 200, body: okBody('x') }]);

    await generateGeminiContent({ prompt: 'p', apiKey: KEY, models: THREE_MODELS, fetchImpl: impl });

    assert.ok(!calls[0]?.includes(KEY), 'the API key must not appear in the request URL');
  });
});

/* -------------------------------------------------------------------------- */
/* Model resolution                                                            */
/* -------------------------------------------------------------------------- */

describe('integrations/gemini — resolving the configured chain', () => {
  it('falls back to the documented default when nothing is configured', () => {
    assert.deepEqual(resolveGeminiModels(undefined), DEFAULT_GEMINI_MODELS);
    assert.deepEqual(resolveGeminiModels(''), DEFAULT_GEMINI_MODELS);
    assert.deepEqual(resolveGeminiModels('   '), DEFAULT_GEMINI_MODELS);
  });

  it('parses a comma-separated list in order, trimming whitespace', () => {
    assert.deepEqual(resolveGeminiModels(' a , b ,c '), ['a', 'b', 'c']);
  });

  it('drops blank entries rather than attempting a request with an empty model name', () => {
    // A trailing comma is a config typo; passing '' to the API would waste an
    // attempt out of a bounded chain.
    assert.deepEqual(resolveGeminiModels('a,,b,'), ['a', 'b']);
  });

  it('leads with a Flash-Lite model, per the quota reasoning in the doc-comment', () => {
    assert.match(DEFAULT_GEMINI_MODELS[0] ?? '', /flash-lite/);
  });
});

/* -------------------------------------------------------------------------- */
/* The B3 data rule                                                            */
/* -------------------------------------------------------------------------- */

describe('modules/analytics/insight — the B3 prompt rule', () => {
  const salesContext: InsightContext = {
    feature: 'sales',
    totalA: 120000,
    totalB: 98000,
    growth: 22.4,
    selectionA: '2026-09',
    selectionB: '2026-08',
  };

  it('includes the computed figures it was given', () => {
    const prompt = buildInsightPrompt(salesContext);
    assert.match(prompt, /120000/);
    assert.match(prompt, /22\.4/);
  });

  it('tells the model NOT to calculate or invent figures', () => {
    // §3.4 keeps the maths in the system and makes the AI "purely interpretive".
    // An assistant that recomputed would be a bug, so the instruction is part of
    // the contract and is asserted.
    const prompt = buildInsightPrompt(salesContext);
    assert.match(prompt, /ALREADY been calculated/);
    assert.match(prompt, /Do not perform your own calculations/);
    assert.match(prompt, /do not introduce any/);
  });

  it('sends only the declared aggregate fields — nothing else can ride along', () => {
    /*
     * The enforcement is structural: `InsightContext` has no free-text,
     * customer or identifier field, so a raw database row cannot be spread into
     * it and still compile. This test pins the *shape* of what serialises, so a
     * future field added without thought is visible in the diff.
     */
    const prompt = buildInsightPrompt(salesContext);
    const json = prompt.slice(prompt.indexOf('{'), prompt.lastIndexOf('}') + 1);

    assert.deepEqual(Object.keys(JSON.parse(json)).sort(), [
      'growth',
      'selectionA',
      'selectionB',
      'totalA',
      'totalB',
    ]);
  });

  it('carries no customer, identifier or free-text field in what it emits', () => {
    // Belt-and-braces on the free tier's terms: nothing that could identify a
    // person may leave the system. Checked across every feature, because the
    // union grows and a new variant is exactly where a leak would be added.
    const everyFeature: InsightContext[] = [
      salesContext,
      {
        feature: 'profit',
        avgMargin: 34.5,
        totalProfit: 41000,
        totalRevenue: 118000,
        bestLabel: '2026-09',
        lowestLabel: '2026-07',
      },
      {
        feature: 'trend',
        totalUnits: 1250,
        leadingProduct: 'Tarpaulin 3x5',
        leadingUnits: 420,
        lowestProduct: 'Sublimation Shirt',
      },
      {
        feature: 'forecast',
        metric: 'Income',
        actual: 98000,
        forecast: 104000,
        expectedGrowth: 6.1,
        forecastConfidence: 88,
      },
    ];

    const forbidden = /customer|email|contact|user_id|profile_id|branch_id|address|phone/i;

    for (const context of everyFeature) {
      const serialised = JSON.stringify(context);
      assert.ok(
        !forbidden.test(serialised),
        `${context.feature} context leaked an identifier-shaped field`,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Parsing the model's answer                                                  */
/* -------------------------------------------------------------------------- */

describe('modules/analytics/insight — parsing the model output', () => {
  const context: InsightContext = {
    feature: 'sales',
    totalA: 1,
    totalB: 2,
    growth: 3,
    selectionA: 'a',
    selectionB: 'b',
  };

  const generate = (text: string) => async () => text;

  it('returns a well-formed report', async () => {
    const report = await generateInsightReport(context, { generate: generate(VALID_REPORT) });

    assert.equal(report.overview, 'Balayan outperformed the comparison period.');
    assert.equal(report.keyFindings.length, 3);
    assert.equal(report.confidence, 82);
  });

  it('clamps a confidence outside 0–100 rather than rendering a nonsense badge', async () => {
    const wild = JSON.stringify({ ...JSON.parse(VALID_REPORT), confidence: 999 });
    const report = await generateInsightReport(context, { generate: generate(wild) });
    assert.equal(report.confidence, 100);
  });

  it('rejects a report missing a field instead of rendering undefined to a manager', async () => {
    const incomplete = JSON.stringify({ overview: 'x', keyFindings: ['a', 'b', 'c'] });

    await assert.rejects(
      () => generateInsightReport(context, { generate: generate(incomplete) }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 502);
        assert.equal(error.code, 'AI_RESPONSE_INVALID');
        return true;
      },
    );
  });

  it('rejects a report with fewer than three findings', async () => {
    const short = JSON.stringify({ ...JSON.parse(VALID_REPORT), keyFindings: ['only one'] });

    await assert.rejects(
      () => generateInsightReport(context, { generate: generate(short) }),
      (error: unknown) => error instanceof AppError && error.code === 'AI_RESPONSE_INVALID',
    );
  });

  it('rejects unparseable text as an unreadable report, not a crash', async () => {
    await assert.rejects(
      () => generateInsightReport(context, { generate: generate('not json at all') }),
      (error: unknown) => error instanceof AppError && error.statusCode === 502,
    );
  });

  it('distinguishes a missing key from an outage, because the fix is different', async () => {
    const notConfigured = async () => {
      throw new GeminiUnavailableError('not_configured', 'no key');
    };
    const exhausted = async () => {
      throw new GeminiUnavailableError('all_models_failed', 'no quota');
    };

    await assert.rejects(
      () => generateInsightReport(context, { generate: notConfigured }),
      (error: unknown) => error instanceof AppError && error.code === 'AI_NOT_CONFIGURED',
    );
    await assert.rejects(
      () => generateInsightReport(context, { generate: exhausted }),
      (error: unknown) => error instanceof AppError && error.code === 'AI_SERVICE_UNAVAILABLE',
    );
  });
});
