// @vitest-environment node
/**
 * The structured-error contract, from the client side.
 *
 * Tier 3 made the API answer a refused checkout with a machine-readable `code`
 * plus `details`, so the POS can point at the exact cart line instead of showing
 * a bare banner. These readers are the only place that contract is interpreted,
 * which makes them a good place for the whole thing to break quietly: a wrong
 * branch here does not crash, it just shows the cashier a generic message and
 * loses the numbers that were the entire point.
 *
 * The cases that matter most are the *negative* ones. `readInsufficientStock`
 * and `readOrderConflict` are called on every failed checkout and every failed
 * order save, in that order, so one of them claiming an error the other owns
 * would mislabel a conflict as a stock problem — or, worse, flag a cart line
 * that was never short.
 */

import { describe, expect, it } from 'vitest';
import { ApiError, isServerRejection, readApiErrorBody } from '../../../shared/api/errors';
import { readInsufficientStock } from './paymentsApi';
import { readOrderConflict } from './ordersApi';

/** An `ApiError` carrying the API's real failure envelope. */
function apiError(status: number, envelope: unknown): ApiError {
  return new ApiError('server said no', status, envelope);
}

const STOCK_DETAILS = { itemId: 'a1b2c3d4-0000-4000-8000-000000000001', itemName: 'A4 Glossy', available: 3, requested: 5 };

const stockEnvelope = {
  error: { code: 'INSUFFICIENT_STOCK', message: 'Only 3 left in stock for "A4 Glossy" (5 requested).', details: STOCK_DETAILS },
};

const conflictEnvelope = {
  error: {
    code: 'ORDER_CONFLICT',
    message: 'This order was changed by someone else while you were editing it.',
    details: {
      orderId: 'a1b2c3d4-0000-4000-8000-000000000002',
      expectedUpdatedAt: '2026-09-16T08:00:00.000Z',
      currentUpdatedAt: '2026-09-16T08:00:07.000Z',
    },
  },
};

describe('readApiErrorBody', () => {
  it('returns the envelope the API sent', () => {
    expect(readApiErrorBody(apiError(409, stockEnvelope))).toEqual(stockEnvelope.error);
  });

  it('returns null for a network failure, which carries no envelope at all', () => {
    // A dropped connection surfaces as a raw TypeError from `fetch`, not an
    // ApiError. Feature code must fall back to its generic message here.
    expect(readApiErrorBody(new TypeError('fetch failed'))).toBeNull();
    expect(readApiErrorBody(new Error('boom'))).toBeNull();
    expect(readApiErrorBody(undefined)).toBeNull();
    expect(readApiErrorBody(null)).toBeNull();
    expect(readApiErrorBody('a string')).toBeNull();
  });

  it('returns null when the payload is not shaped like an envelope', () => {
    expect(readApiErrorBody(apiError(500, null))).toBeNull();
    expect(readApiErrorBody(apiError(500, 'Internal Server Error'))).toBeNull();
    expect(readApiErrorBody(apiError(500, { message: 'no error key' }))).toBeNull();
    expect(readApiErrorBody(apiError(500, { error: 'not an object' }))).toBeNull();
  });
});

describe('readInsufficientStock', () => {
  it('reads the shortfall numbers off a real 409', () => {
    expect(readInsufficientStock(apiError(409, stockEnvelope))).toEqual(STOCK_DETAILS);
  });

  it('ignores an ORDER_CONFLICT, which a sibling reader owns', () => {
    // Both readers run on every failure. If this one claimed a conflict, the
    // cashier would be told a cart line was short when nothing was.
    expect(readInsufficientStock(apiError(409, conflictEnvelope))).toBeNull();
  });

  it('ignores a right-looking error with no structured details', () => {
    expect(readInsufficientStock(apiError(409, { error: { code: 'INSUFFICIENT_STOCK', message: 'short' } }))).toBeNull();
  });

  it('ignores details that are only partly there', () => {
    const partial = { error: { code: 'INSUFFICIENT_STOCK', details: { itemName: 'A4 Glossy', available: 3 } } };
    expect(readInsufficientStock(apiError(409, partial))).toBeNull();
  });

  it('ignores a foreign details payload that is not ours', () => {
    // Postgres also puts constraint names in `details`, and the service passes
    // that straight through when it is not our JSON. A string must not be
    // mistaken for a shortfall.
    const foreign = { error: { code: 'INSUFFICIENT_STOCK', details: 'sales_transactions_idempotency_key_key' } };
    expect(readInsufficientStock(apiError(409, foreign))).toBeNull();
  });

  it('ignores numbers that arrive as strings', () => {
    const stringly = {
      error: { code: 'INSUFFICIENT_STOCK', details: { itemId: 'x', itemName: 'A4 Glossy', available: '3', requested: '5' } },
    };
    expect(readInsufficientStock(apiError(409, stringly))).toBeNull();
  });

  it('returns null for a plain network failure', () => {
    expect(readInsufficientStock(new TypeError('fetch failed'))).toBeNull();
  });
});

describe('readOrderConflict', () => {
  it('reads both versions off a real 409', () => {
    expect(readOrderConflict(apiError(409, conflictEnvelope))).toEqual(conflictEnvelope.error.details);
  });

  it('ignores an INSUFFICIENT_STOCK, which a sibling reader owns', () => {
    expect(readOrderConflict(apiError(409, stockEnvelope))).toBeNull();
  });

  it('ignores details that are only partly there', () => {
    const partial = {
      error: { code: 'ORDER_CONFLICT', details: { orderId: 'x', expectedUpdatedAt: '2026-09-16T08:00:00.000Z' } },
    };
    expect(readOrderConflict(apiError(409, partial))).toBeNull();
  });

  it('returns null for a plain network failure', () => {
    expect(readOrderConflict(new TypeError('fetch failed'))).toBeNull();
  });
});

describe('the two readers together', () => {
  it('classifies each 409 as exactly one kind of problem', () => {
    // This is how POSPage actually calls them, and the reason the negative cases
    // above matter: at most one may claim a given failure.
    for (const envelope of [stockEnvelope, conflictEnvelope]) {
      const error = apiError(409, envelope);
      const claims = [readInsufficientStock(error) !== null, readOrderConflict(error) !== null];
      expect(claims.filter(Boolean)).toHaveLength(1);
    }
  });
});

describe('isServerRejection', () => {
  it('is true for a refusal the server actually issued', () => {
    for (const status of [400, 401, 403, 404, 409, 422, 429]) {
      expect(isServerRejection(apiError(status, stockEnvelope))).toBe(true);
    }
  });

  it('is false for a 5xx, because the write may already have landed', () => {
    // This is the case that matters. The sale route writes an audit entry *after*
    // the RPC returns, so a 500 can sit on top of a committed sale. Treating that
    // as "nothing was written" is how a customer is charged twice.
    for (const status of [500, 502, 503, 504]) {
      expect(isServerRejection(apiError(status, stockEnvelope))).toBe(false);
    }
  });

  it('is false for a failure that never reached the server', () => {
    // A dropped connection surfaces as a raw TypeError from `fetch`.
    expect(isServerRejection(new TypeError('fetch failed'))).toBe(false);
    expect(isServerRejection(new Error('timeout'))).toBe(false);
    expect(isServerRejection(undefined)).toBe(false);
    expect(isServerRejection('boom')).toBe(false);
  });
});
