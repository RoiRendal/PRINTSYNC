// @vitest-environment node
/**
 * `describeApiError` is the single place where a failed write turns into a
 * sentence a staff member reads. It exists because five screens used to swallow
 * their failures outright, so the rule it encodes has to hold:
 *
 *   - a 4xx is a **verdict** — the server validated and refused, so its own words
 *     are the most accurate thing available and may be stated plainly;
 *   - anything else is an **open question**. A 5xx can be raised after the write
 *     committed, and a dropped connection says nothing at all, so neither may be
 *     presented as "that failed". A staff member who believes a save failed will
 *     simply try it again.
 */

import { describe, expect, it } from 'vitest';
import { ApiError, describeApiError } from './errors';

/**
 * Builds what `apiClient` throws: the parsed body lands on `details`, and the
 * envelope's message is also copied onto the error itself.
 */
function serverError(status: number, message: string, code?: string): ApiError {
  return new ApiError(message, status, {
    error: { ...(code === undefined ? {} : { code }), message },
  });
}

const FALLBACK = 'The customer could not be deleted.';

describe('describeApiError', () => {
  it("shows the server's own words for a 4xx, because it knows why it refused", () => {
    const described = describeApiError(
      serverError(409, 'A user with this email address already exists.', 'EMAIL_ALREADY_REGISTERED'),
      FALLBACK,
    );

    expect(described).toBe('A user with this email address already exists.');
  });

  it('falls back when a 4xx carries an empty message', () => {
    expect(describeApiError(new ApiError('', 400, { error: {} }), FALLBACK)).toBe(FALLBACK);
  });

  it('falls back when there is no envelope at all', () => {
    expect(describeApiError(new ApiError('', 400, 'not json'), FALLBACK)).toBe(FALLBACK);
  });

  it('prefers the session explanation over the server wording on a 401', () => {
    // "Authentication is required." is accurate but tells the user nothing about
    // what to do; the session has almost always expired.
    const described = describeApiError(serverError(401, 'Authentication is required.'), FALLBACK);

    expect(described).toMatch(/session has expired/i);
  });

  it('prefers the permission explanation on a 403', () => {
    const described = describeApiError(serverError(403, 'Forbidden'), FALLBACK);

    expect(described).toMatch(/permission/i);
  });

  it('never claims a 5xx failed the change, even when the server supplied a message', () => {
    const described = describeApiError(serverError(503, 'The customer could not be deleted.'), FALLBACK);

    expect(described).not.toBe('The customer could not be deleted.');
    expect(described).toMatch(/could not confirm/i);
  });

  it('treats a request that never reached the API as unconfirmed as well', () => {
    // A rejected `fetch` throws a TypeError, not an ApiError.
    const described = describeApiError(new TypeError('Failed to fetch'), FALLBACK);

    expect(described).toMatch(/could not be reached/i);
  });

  it('handles a non-Error rejection without throwing', () => {
    expect(describeApiError('boom', FALLBACK)).toMatch(/could not be reached/i);
    expect(describeApiError(undefined, FALLBACK)).toMatch(/could not be reached/i);
  });

  it('keeps the 4xx verdict distinct from the unconfirmed wording', () => {
    // The whole point of the helper: these two must never read the same, because
    // one means "nothing was written" and the other means "we do not know".
    const verdict = describeApiError(serverError(409, 'Already exists.'), FALLBACK);
    const open = describeApiError(serverError(500, 'Already exists.'), FALLBACK);

    expect(verdict).not.toBe(open);
  });
});
