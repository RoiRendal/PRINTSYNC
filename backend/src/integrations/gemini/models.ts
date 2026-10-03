/**
 * The model failover chain.
 *
 * ### Why a chain exists at all
 *
 * The AI insight report is a "nice to have" attached to a screen a manager is
 * already looking at. If the model that answers it has hit its daily quota, the
 * honest options are: show an error and make the manager retry tomorrow, or ask a
 * different model the same question. The research paper (§3.4) calls for the
 * second — "to ensure that the AI service can be accessed in the event that one
 * of these models reaches its quota" — and the ordering below is how that is
 * expressed in code.
 *
 * ### Why the list is not the paper's list
 *
 * §3.4 names Gemini 2.0 Flash, 2.0 Flash-Lite, 2.5 Flash, 2.5 Flash-Lite and
 * 2.5 Pro. **Both 2.0 models have since been shut down**, the 2.5 family is
 * restricted to accounts that had already used it, and Pro moved behind billing —
 * so the chain as written cannot run. The *intent* (a quota failover chain) is
 * preserved; only the model names are current. `GEMINI_MODELS` overrides this
 * list without a code change, which is the point.
 *
 * ### Why the two Flash-Lite models lead
 *
 * The job — turn figures the backend has already computed into a short paragraph
 * — is a low-complexity text task, and the Flash-Lite tier carries roughly
 * **25× the daily free-tier allowance** of the full Flash models (about 500
 * requests a day versus about 20). Leading with capability instead of quota
 * would burn the 20-request budget on questions Flash-Lite answers just as well.
 *
 * The full Flash model stays at the end as a last resort: when the Lite budget is
 * gone, a handful of higher-quality answers beats no answer at all.
 *
 * Quota figures move. They are recorded here as of **2026-10-03** and are only
 * authoritative for the project's own key in AI Studio → Rate limits.
 */
export const DEFAULT_GEMINI_MODELS: readonly string[] = [
  'gemini-3.5-flash-lite', // ~500 requests/day — best daily allowance
  'gemini-3.1-flash-lite', // ~500 requests/day — second Lite tier
  'gemini-3.8-flash', // ~20 requests/day — higher quality, last resort
];

/**
 * Turn the `GEMINI_MODELS` environment value into the chain to use.
 *
 * Exported and pure so it can be tested without a process environment — the
 * same reason `shouldSkipRateLimit` is exported (`middleware/apiRateLimit.ts`).
 *
 * A blank or missing value means "use the default". Individual blank entries are
 * dropped rather than treated as model names: a trailing comma in a config value
 * is a typo, and passing `''` to the API would waste an attempt on a request that
 * cannot succeed.
 */
export function resolveGeminiModels(configured: string | undefined): readonly string[] {
  const models = (configured ?? '')
    .split(',')
    .map((model) => model.trim())
    .filter((model) => model.length > 0);

  return models.length > 0 ? models : DEFAULT_GEMINI_MODELS;
}
