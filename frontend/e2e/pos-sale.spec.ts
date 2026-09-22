import { expect, test } from '@playwright/test';
import { API, findSellableProduct, login, skipReason } from './helpers';

/**
 * The retail sale, end to end, including the double-charge defence.
 *
 * Selectors are derived from the real components, not invented:
 *   - `Search catalog`  — `POSCatalog.tsx`, the search input's `aria-label`
 *   - product tiles     — `POSCatalog.tsx`, a `<button>` per item, disabled at zero stock
 *   - `Quick Pay`       — `POSCart.tsx`, the retail-mode checkout button
 *   - `Confirm & Pay`   — `POSCheckoutModal.tsx`, the confirm button
 *   - `Last receipt`    — `POSPage.tsx`, the toolbar affordance that outlives the dialog
 *
 * NOT YET RUN. This file has never executed against a live target — it is
 * scaffolded, type-checked and discovered by the runner, and nothing more. Do not
 * treat a green `--list` as evidence that a sale works. The first real run needs a
 * target and credentials; see `.github/workflows/e2e.yml`.
 */

const reason = skipReason();
test.skip(reason !== null, reason ?? '');

test('a retail sale completes, and replaying the attempt does not charge twice', async ({ page }) => {
  await login(page);

  const product = await findSellableProduct(page);
  test.skip(product === null, 'no in-stock product to sell');
  if (product === null) return;

  await page.goto('/pos');
  await page.getByLabel('Search catalog').fill(product.name);

  // Narrow to the first tile whose text contains the name. Scoped this way rather
  // than by an index, so a catalog reorder does not silently sell the wrong item.
  const tile = page.getByRole('button').filter({ hasText: product.name }).first();
  await expect(tile).toBeEnabled();
  await tile.click();

  const payButton = page.getByRole('button', { name: 'Quick Pay' });
  await expect(payButton).toBeEnabled();
  await payButton.click();

  // Registered before the click, so the request cannot be missed.
  const saleRequest = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().includes(`${API}/payments/transactions`),
  );
  const saleResponse = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().includes(`${API}/payments/transactions`),
  );

  await page.getByRole('button', { name: 'Confirm & Pay' }).click();

  const request = await saleRequest;
  const response = await saleResponse;
  expect(response.status(), 'the sale must be accepted').toBeLessThan(300);

  const sold = (await response.json()) as { id: string };
  const attempt = request.postDataJSON() as { idempotencyKey?: string };
  expect(attempt.idempotencyKey, 'a sale must carry an idempotency key').toBeTruthy();

  // The toolbar keeps a receipt affordance after the sale. The checkout dialog
  // dismisses itself two seconds after confirming, so without this the receipt
  // would be reachable only by whoever happened to click in time.
  await expect(page.getByRole('button', { name: /Last receipt/ })).toBeVisible({ timeout: 30_000 });

  /* ------------------------------------------------------------------------
   * The double-charge defence.
   *
   * Same attempt, same key, sent a second time — the shape of a double-click, or
   * of a retry after the response was dropped. The server must replay the sale it
   * already committed rather than insert another. Asserting the returned id is
   * the precise form of that: a second row would come back with a different id.
   * ---------------------------------------------------------------------- */
  const replay = await page.request.post(`${API}/payments/transactions`, { data: attempt });
  expect(replay.ok(), `the replay was refused: HTTP ${replay.status()}`).toBe(true);

  const replayed = (await replay.json()) as { id: string };
  expect(replayed.id, 'a replay must return the original sale, not a new one').toBe(sold.id);
});
