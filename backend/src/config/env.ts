import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ override: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:3000'),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  /**
   * Absolute path to the built SPA, when the API is serving it.
   *
   * Optional on purpose: in development the frontend runs on its own Vite dev
   * server and this is unset, so the API stays a pure JSON service. In the
   * single-origin deployment the two are one process and this points at the
   * directory `vite build` produced. See `resolveFrontendDir()` in `app.ts` for
   * the default it falls back to.
   */
  FRONTEND_DIST: z.string().optional(),
  /**
   * The Gemini API key used by the AI insight reports.
   *
   * **Server-side only.** It is read in exactly one place —
   * `integrations/gemini/client.ts` — and never returned in a response, written
   * to a log, or exposed through a `VITE_*` variable (which would bake it into
   * the public browser bundle).
   *
   * Optional on purpose: without it the insights endpoint answers with a clear
   * "not configured" error instead of failing at boot, so development and the
   * test suite run without a key. When it is absent the rest of the system is
   * unaffected — analytics that does not need AI keeps working.
   */
  GEMINI_API_KEY: z.string().min(1).optional(),
  /**
   * The model failover chain, in order, comma-separated.
   *
   * ### Why this is configuration rather than an array in the source
   *
   * Google retires models on its own schedule — it shut down the entire 2.0
   * family while this feature was being built. Keeping the order in an
   * environment variable means a retired model is corrected by changing a value,
   * not by shipping a new image, so the failover chain cannot silently rot into
   * a list of models that no longer exist.
   *
   * Unset means `DEFAULT_GEMINI_MODELS` in `integrations/gemini/models.ts`
   * applies. Blank entries are dropped rather than treated as model names.
   */
  GEMINI_MODELS: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid backend environment configuration', parsedEnv.error.flatten().fieldErrors);
  throw new Error('Invalid backend environment configuration');
}

export const env = parsedEnv.data;
