import { expect, type Page } from '@playwright/test';

/**
 * Shared configuration and the login step for the E2E suite.
 *
 * Everything here reads from the environment on purpose. The suite must be
 * runnable against any target — a scratch Supabase project, a staging deploy, the
 * live shop — without editing a file, because the alternative is a hard-coded URL
 * that somebody eventually points at production by accident.
 */
export const BASE_URL = process.env.E2E_BASE_URL ?? '';
export const E2E_EMAIL = process.env.E2E_EMAIL ?? '';
export const E2E_PASSWORD = process.env.E2E_PASSWORD ?? '';

/** The API prefix the SPA calls. Relative, so it follows `baseURL`. */
export const API = '/api/v1';

/**
 * Why this suite cannot run, or `null` when it can.
 *
 * Returning a reason rather than throwing is what lets every spec skip cleanly
 * and exit 0. An E2E job that fails because a secret is unset teaches people to
 * ignore red runs, and an ignored red run is worse than no run.
 */
export function skipReason(): string | null {
  const missing: string[] = [];
  if (!BASE_URL) missing.push('E2E_BASE_URL');
  if (!E2E_EMAIL) missing.push('E2E_EMAIL');
  if (!E2E_PASSWORD) missing.push('E2E_PASSWORD');
  if (missing.length === 0) return null;
  return `E2E configuration missing (${missing.join(', ')}) — see .github/workflows/e2e.yml`;
}

/**
 * Signs in and waits for the redirect away from `/login`.
 *
 * `LoginPage` renders its error banner instead of navigating when the credentials
 * are wrong, so waiting on the URL is what turns "bad password" into a clear
 * failure here rather than a confusing one three assertions later.
 */
export async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(E2E_EMAIL);
  await page.getByLabel('Password').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

export interface InventoryRow {
  id: string;
  name: string;
  stock: number;
}

/**
 * Finds an in-stock product to sell.
 *
 * Discovered from the API rather than hard-coded, because this runs against a
 * real shop database whose inventory nobody here controls. A test that depends on
 * a particular SKU existing is a test that goes red when somebody renames a
 * product, which trains people to ignore it.
 *
 * Returns `null` when nothing is in stock — the caller should skip rather than
 * fail, since an empty catalog is a data condition, not a defect.
 */
export async function findSellableProduct(page: Page): Promise<InventoryRow | null> {
  const response = await page.request.get(`${API}/inventory?limit=50`);
  if (!response.ok()) {
    throw new Error(`could not list inventory: HTTP ${response.status()}`);
  }

  const body = (await response.json()) as unknown;
  const rows: InventoryRow[] = Array.isArray(body)
    ? (body as InventoryRow[])
    : (((body as { data?: InventoryRow[] }).data ?? []) as InventoryRow[]);

  return rows.find((row) => Number(row.stock) > 0) ?? null;
}
