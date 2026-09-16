import { useCallback, useEffect, useRef } from 'react';

/**
 * A fresh key for one checkout attempt.
 *
 * `crypto.randomUUID` is only exposed in a secure context, so a shop running the
 * terminal over plain HTTP on the local network would not have it. `getRandomValues`
 * carries no such restriction, so it is the fallback — shaped into a real UUID so
 * the server's validation accepts either path.
 */
export function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  // Set the version (4) and variant (10xx) nibbles, so this is a well-formed v4
  // UUID rather than merely a random string that happens to look like one.
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface CheckoutAttemptKey {
  /**
   * Returns the key for the checkout attempt in progress, minting one if this is
   * the first try. Every retry of the same attempt gets the same key back, which
   * is what makes the retry safe: the server recognises the repeat and replays
   * the original sale instead of charging the customer a second time.
   */
  beginAttempt: () => string;
  /**
   * The key of the most recent attempt, or `null` if there has not been one.
   *
   * Used to reconcile a failure that carried no verdict — a dropped connection,
   * a timeout — by asking the server whether a sale exists under this key.
   */
  peekAttempt: () => string | null;
  /**
   * Forgets the current key. Call it once a sale has definitely completed, so
   * the next checkout is a genuinely new sale rather than a replay of this one.
   *
   * Deliberately *not* called on failure: keeping the key is what lets the
   * cashier retry an attempt that may or may not have landed without risking a
   * second charge.
   */
  completeAttempt: () => void;
}

/**
 * Owns the lifetime of the idempotency key for the sale currently on the till.
 *
 * The rule is one sentence — **a different cart is a different sale** — and it is
 * the entire double-charge defence on the client side. Two ways to get it wrong,
 * and both are silent:
 *
 *   - Rotate too eagerly (per click, or per render) and a retry after a dropped
 *     response looks like a new sale, so the customer is charged twice.
 *   - Rotate too rarely and the next genuine sale replays the previous one, so
 *     the shop takes money for goods that were never rung up.
 *
 * `cartSignature` is what tells the two apart. It must change when the *sale*
 * changes — items, quantities, attached designs — and not merely when the
 * component re-renders. `POSPage` builds it for exactly that reason.
 */
export function useCheckoutAttemptKey(cartSignature: string): CheckoutAttemptKey {
  const keyRef = useRef<string | null>(null);

  /*
   * Clearing on a signature change is what implements "a different cart is a
   * different sale". A cart that has *not* changed deliberately keeps its key.
   */
  useEffect(() => {
    keyRef.current = null;
  }, [cartSignature]);

  const beginAttempt = useCallback((): string => {
    const key = keyRef.current ?? createIdempotencyKey();
    keyRef.current = key;
    return key;
  }, []);

  const peekAttempt = useCallback((): string | null => keyRef.current, []);

  const completeAttempt = useCallback((): void => {
    keyRef.current = null;
  }, []);

  return { beginAttempt, peekAttempt, completeAttempt };
}
