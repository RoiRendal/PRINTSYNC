/**
 * The double-charge defence, in one hook.
 *
 * `useCheckoutAttemptKey` exists because this rule is the difference between
 * charging a customer once and charging them twice, and because inside a
 * 700-line page component it had no way to be tested at all.
 *
 * Both ways of getting it wrong are silent, which is why every branch here is
 * asserted rather than reasoned about:
 *
 *   - rotate per click → a retry after a dropped response is treated as a new
 *     sale, and the customer pays twice;
 *   - rotate never → the next genuine sale replays the previous one, and the
 *     shop hands over goods that were never rung up.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIdempotencyKey, useCheckoutAttemptKey } from './useCheckoutAttemptKey';

/** Shape the server enforces with `z.string().uuid()`. */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function renderKey(initialSignature: string) {
  return renderHook(({ signature }) => useCheckoutAttemptKey(signature), {
    initialProps: { signature: initialSignature },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('key lifetime', () => {
  it('mints a server-acceptable key on the first attempt', () => {
    const { result } = renderKey('a:1');

    const key = result.current.beginAttempt();

    expect(key).toMatch(UUID_V4);
  });

  it('reuses the same key for every retry of one attempt', () => {
    // The cashier hits Confirm, the response is lost, they hit it again. Both
    // requests must carry the same key so the server replays rather than
    // inserts.
    const { result } = renderKey('a:1');

    const first = result.current.beginAttempt();
    const retry = result.current.beginAttempt();
    const retryAgain = result.current.beginAttempt();

    expect(retry).toBe(first);
    expect(retryAgain).toBe(first);
  });

  it('keeps the key when an attempt fails, so a retry stays safe', () => {
    // Nothing is cleared on failure — that is the whole point. The attempt may
    // have committed server-side; reusing the key is what makes retrying
    // harmless either way.
    const { result } = renderKey('a:1');

    const attempted = result.current.beginAttempt();
    // ...the request fails here; the hook is not told, and must not react...
    expect(result.current.peekAttempt()).toBe(attempted);
    expect(result.current.beginAttempt()).toBe(attempted);
  });

  it('rotates the key when the cart changes', () => {
    const { result, rerender } = renderKey('a:1');

    const firstSale = result.current.beginAttempt();
    rerender({ signature: 'a:1|b:2' });
    const secondSale = result.current.beginAttempt();

    expect(secondSale).not.toBe(firstSale);
  });

  it('rotates when only a quantity changes', () => {
    // A signature that ignored quantities would let "2 more of the same item"
    // replay the previous sale and quietly under-charge.
    const { result, rerender } = renderKey('a:1');

    const first = result.current.beginAttempt();
    rerender({ signature: 'a:2' });

    expect(result.current.beginAttempt()).not.toBe(first);
  });

  it('rotates when only the attached design changes', () => {
    const { result, rerender } = renderKey('a:1:');

    const first = result.current.beginAttempt();
    rerender({ signature: 'a:1:design-7' });

    expect(result.current.beginAttempt()).not.toBe(first);
  });

  it('keeps the key across a re-render that does not change the cart', () => {
    // `updateQty` rebuilds the cart array even when it clamps to the same
    // quantity, so identity-based effects would rotate here and break retries.
    const { result, rerender } = renderKey('a:1');

    const first = result.current.beginAttempt();
    rerender({ signature: 'a:1' });

    expect(result.current.beginAttempt()).toBe(first);
  });

  it('mints a fresh key for the next sale once the attempt completes', () => {
    const { result } = renderKey('a:1');

    const completed = result.current.beginAttempt();
    act(() => result.current.completeAttempt());
    const next = result.current.beginAttempt();

    expect(next).not.toBe(completed);
  });
});

describe('peekAttempt', () => {
  it('is null before any attempt', () => {
    const { result } = renderKey('a:1');

    expect(result.current.peekAttempt()).toBeNull();
  });

  it('does not mint a key as a side effect', () => {
    // It is a read. Reconciliation calls it after a failure, and minting there
    // would hand the lookup a key nothing was ever sent under.
    const { result } = renderKey('a:1');

    expect(result.current.peekAttempt()).toBeNull();
    expect(result.current.peekAttempt()).toBeNull();
  });

  it('returns the key of the attempt in flight', () => {
    const { result } = renderKey('a:1');

    const key = result.current.beginAttempt();

    expect(result.current.peekAttempt()).toBe(key);
  });

  it('is null again once the cart changes', () => {
    const { result, rerender } = renderKey('a:1');
    result.current.beginAttempt();

    rerender({ signature: 'a:1|b:2' });

    expect(result.current.peekAttempt()).toBeNull();
  });
});

describe('createIdempotencyKey', () => {
  it('uses the platform UUID generator when it is available', () => {
    const randomUUID = vi.fn(() => '11111111-2222-4333-8444-555555555555');
    vi.stubGlobal('crypto', { randomUUID, getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) });

    expect(createIdempotencyKey()).toBe('11111111-2222-4333-8444-555555555555');
    expect(randomUUID).toHaveBeenCalled();
  });

  it('still produces a valid v4 UUID without crypto.randomUUID', () => {
    // `randomUUID` only exists in a secure context, so a terminal served over
    // plain HTTP on the shop's local network takes this path. It must not throw,
    // and the result must still pass the server's uuid check.
    vi.stubGlobal('crypto', {
      getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
    });

    const key = createIdempotencyKey();

    expect(key).toMatch(UUID_V4);
  });

  it('does not repeat itself', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
    });

    const keys = new Set(Array.from({ length: 200 }, () => createIdempotencyKey()));

    expect(keys.size).toBe(200);
  });
});
