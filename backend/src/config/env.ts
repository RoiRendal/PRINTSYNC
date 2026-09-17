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
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid backend environment configuration', parsedEnv.error.flatten().fieldErrors);
  throw new Error('Invalid backend environment configuration');
}

export const env = parsedEnv.data;
