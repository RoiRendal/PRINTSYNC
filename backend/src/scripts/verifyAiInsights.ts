#!/usr/bin/env tsx
/**
 * Prove the AI insight integration works against the **real** Gemini API.
 *
 * ### Why this exists
 *
 * The unit tests stub the network on purpose, so they prove the failover logic
 * and the prompt contents but say nothing about whether a real key is accepted,
 * whether the real API accepts our `responseSchema`, or whether a real response
 * survives the parser. Those are exactly the things that fail on the day of a
 * demonstration and cannot be checked by reading code.
 *
 * It is also the evidence the plan asks for (§6, item 4): a real request and a
 * real response showing Gemini producing the report, so §3.4 can be defended as
 * *implemented* rather than *planned*.
 *
 * ### Usage
 *
 *   npm run verify:ai                                          # the production chain
 *   GEMINI_MODELS=gemini-3.5-flash-lite npm run verify:ai
 *   GEMINI_MODELS=gemini-2.0-flash npm run verify:ai
 *
 * Pinning `GEMINI_MODELS` to a single id is how each link of the chain is proved
 * individually — the happy path alone cannot tell you *which* model answered.
 *
 * ### It never prints the key
 *
 * Only its length and whether it looks well-formed. A diagnostic that leaks the
 * secret it is diagnosing is worse than no diagnostic.
 *
 * ### It lives in `src/scripts/`, not `scripts/`
 *
 * `tsconfig.json` includes only `src/**\/*.ts`, so a script under `scripts/` is
 * never type-checked and can rot silently against a changing service signature.
 * This sits alongside `provisionUser.ts` and `seedDemoData.ts` so `npm run lint`
 * covers it, and it is a **script rather than a test** because it needs a key and
 * a network — it must never be wired into `npm test`.
 */
import { env } from '../config/env.js';
import { resolveGeminiModels } from '../integrations/gemini/models.js';
import {
  buildInsightPrompt,
  generateInsightReport,
  type InsightContext,
} from '../modules/analytics/insight.service.js';

/**
 * A realistic `sales` context — the same shape the Sales Comparison section
 * sends. Synthetic figures; no customer data, per the B3 rule.
 */
const CONTEXT: InsightContext = {
  feature: 'sales',
  totalA: 128400,
  totalB: 96300,
  growth: 33.33,
  selectionA: '2026-09',
  selectionB: '2026-08',
};

async function main(): Promise<void> {
  const key = env.GEMINI_API_KEY;
  if (!key) {
    console.error('FAIL: GEMINI_API_KEY is not set. Add it to backend/.env and retry.');
    process.exit(1);
  }

  console.log('Key check');
  console.log(`  present             : yes (${key.length} characters)`);
  console.log(`  classic AIza prefix : ${key.startsWith('AIza') ? 'yes' : 'no (newer key formats differ — not an error by itself)'}`);
  console.log(`  quotes/whitespace   : ${key === key.trim() && !/^["']/.test(key) ? 'clean' : 'DIRTY — re-paste the value'}`);

  const chain = resolveGeminiModels(env.GEMINI_MODELS);
  console.log(`\nModel chain: ${chain.join('  ->  ')}`);

  console.log('\n--- PROMPT SENT (this is everything that leaves the system) ---');
  console.log(buildInsightPrompt(CONTEXT));

  const startedAt = Date.now();
  try {
    const report = await generateInsightReport(CONTEXT);
    const elapsed = Date.now() - startedAt;

    console.log(`\n--- SUCCEEDED in ${elapsed} ms ---`);
    console.log(JSON.stringify(report, null, 2));
    console.log('\nPASS: the key is accepted and a real report was produced.');
  } catch (error) {
    const elapsed = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n--- FAILED after ${elapsed} ms ---`);
    console.error(message);
    console.error('\nFAIL: no report was produced. See the message above.');
    process.exit(1);
  }
}

await main();
