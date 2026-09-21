import { defineConfig, devices } from '@playwright/test';

/**
 * PRINTSYNC end-to-end configuration.
 *
 * These tests drive a **running** PRINTSYNC against a **real** database: a sale
 * rung up here is a real row in the shop's books, and it moves the day's revenue
 * figure. That is the point — the guarantees being tested (a retry must not
 * double-charge, a lost race must be refused rather than silently overwrite) only
 * exist across a real client, a real API and a real Postgres. None of them can be
 * asserted against a mock.
 *
 * It is also exactly why the target is **never defaulted**. `E2E_BASE_URL` has to
 * be set explicitly, so pointing these tests at the live shop is a decision
 * somebody makes on purpose, rather than a consequence of running
 * `npm run test:e2e` in the wrong directory. With nothing configured, every spec
 * skips and exits 0 — see `e2e/helpers.ts`.
 *
 * Deliberately **not** wired into `ci.yml`: CI withholds live credentials by
 * design, and a blocking gate that cannot run is a gate somebody eventually
 * disables. `.github/workflows/e2e.yml` runs it separately and non-blocking.
 */
export default defineConfig({
  testDir: './e2e',

  // One worker. Two of these tests race each other on purpose, and a shared
  // database makes cross-test interference the likeliest cause of a mystery
  // failure — serialising them removes a whole category of flake.
  workers: 1,
  fullyParallel: false,

  // A stray `test.only` in CI would silently narrow the run to one test.
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,

  timeout: 60_000,
  expect: { timeout: 15_000 },

  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: process.env.E2E_BASE_URL,
    // A sale is a write, so a failure has to be readable rather than guessed at.
    // `retain-on-failure` keeps the trace for red runs and nothing for green ones.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
