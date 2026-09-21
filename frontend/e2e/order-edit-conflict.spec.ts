import { expect, test } from '@playwright/test';
import { API, login, skipReason } from './helpers';

/**
 * Two staff editing the same order.
 *
 * The guarantee: when the second save loses the race, the server **refuses it**
 * rather than letting it overwrite the first. That is the whole point of the
 * `expectedUpdatedAt` token — without it, whoever clicks Save last wins silently,
 * and the first person's work is gone with no error and no trace.
 *
 * Driven through two real browser sessions against the real API rather than
 * through the orders UI. The UI's job is to *surface* the conflict; the server's
 * job is to *detect* it, and detection is the half that fails silently. Asserting
 * it here keeps the test deterministic, and it exercises the exact contract
 * `readOrderConflict` in `ordersApi.ts` depends on.
 *
 * Writes only an order it created itself, and deletes it afterwards.
 *
 * NOT YET RUN. See the note in `pos-sale.spec.ts` — same caveat, same reason.
 */

const reason = skipReason();
test.skip(reason !== null, reason ?? '');

test('a lost race is refused with both versions, not silently overwritten', async ({ browser }) => {
  // Two contexts, so genuinely two sessions with two cookies.
  const sessionA = await browser.newContext();
  const sessionB = await browser.newContext();

  try {
    const pageA = await sessionA.newPage();
    const pageB = await sessionB.newPage();
    await login(pageA);
    await login(pageB);

    // Our own row, so the test never mutates an order the shop actually cares about.
    const stamp = Date.now();
    const created = await pageA.request.post(`${API}/orders`, {
      data: {
        customer: `E2E conflict ${stamp}`,
        item: 'E2E conflict probe',
        quantity: 1,
        status: 'Pending',
        amount: 0,
        isCustom: true,
        notes: 'created by e2e/order-edit-conflict.spec.ts',
      },
    });
    expect(created.status(), 'the probe order must be created').toBeLessThan(300);

    const order = (await created.json()) as { id: string; updatedAt: string };
    expect(order.updatedAt, 'a created order must carry its version token').toBeTruthy();

    // Both sessions are now working from the same version — the ordinary state of
    // two people looking at the same order.
    const sharedVersion = order.updatedAt;

    const firstSave = await pageA.request.patch(`${API}/orders/${order.id}`, {
      data: { status: 'Designing', expectedUpdatedAt: sharedVersion },
    });
    expect(firstSave.status(), 'the first save must succeed').toBeLessThan(300);
    const afterFirst = (await firstSave.json()) as { updatedAt: string };
    expect(afterFirst.updatedAt, 'a save must move the version token').not.toBe(sharedVersion);

    // The second save still believes it is on `sharedVersion`, which no longer exists.
    const lostRace = await pageB.request.patch(`${API}/orders/${order.id}`, {
      data: { status: 'Completed', expectedUpdatedAt: sharedVersion },
    });

    expect(lostRace.status(), 'a stale save must be refused with 409').toBe(409);
    const body = (await lostRace.json()) as {
      code?: string;
      details?: { orderId?: string; expectedUpdatedAt?: string; currentUpdatedAt?: string };
    };
    expect(body.code, 'the refusal must be identifiable as a conflict').toBe('ORDER_CONFLICT');

    // Both versions, so the UI can say what happened and pull the other edit.
    expect(body.details?.orderId).toBe(order.id);
    expect(body.details?.expectedUpdatedAt).toBe(sharedVersion);
    expect(body.details?.currentUpdatedAt).toBe(afterFirst.updatedAt);

    // The assertion that matters: the refused save changed nothing. A 409 that
    // still wrote would pass every check above and lose the first person's work.
    const reread = await pageA.request.get(`${API}/orders/${order.id}`);
    const current = (await reread.json()) as { status: string };
    expect(current.status, 'the refused save must not have written anything').toBe('Designing');

    // Leave the database as we found it.
    const cleanup = await pageA.request.delete(`${API}/orders/${order.id}`);
    expect(cleanup.status(), 'the probe order must be removed').toBeLessThan(300);
  } finally {
    await sessionA.close();
    await sessionB.close();
  }
});
