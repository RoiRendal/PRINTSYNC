export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/** The `error` object inside the API's failure envelope. */
export interface ApiErrorBody {
  code?: string;
  message?: string;
  details?: unknown;
}

/**
 * Digs the server's structured error envelope out of a caught value.
 *
 * The API answers failures with `{ error: { code, message, details? } }`, and the
 * client hands the whole payload back on `ApiError.details`. Feature code that
 * needs to branch on the machine-readable `code` — rather than pattern-matching
 * on prose — should go through here, so the envelope shape is known in one place.
 *
 * Returns `null` for anything that is not an API error, or that carried no
 * envelope (a network failure, a non-JSON response).
 */
export function readApiErrorBody(error: unknown): ApiErrorBody | null {
  if (!(error instanceof ApiError)) return null;
  const payload = error.details;
  if (!payload || typeof payload !== 'object') return null;
  const envelope = (payload as { error?: unknown }).error;
  if (!envelope || typeof envelope !== 'object') return null;
  return envelope as ApiErrorBody;
}

/**
 * `true` when the server answered and *refused* the request — a 4xx.
 *
 * This is the difference between "the request was rejected" and "we do not know
 * what happened", and the distinction is load-bearing wherever a failure might
 * have left a side effect behind. A 4xx means the API reached its own validation
 * and said no, so nothing was written. Anything else — a `fetch` that never
 * completed, a timeout, a 5xx raised *after* the write committed — leaves the
 * caller unable to say.
 *
 * Callers that treat an unanswerable question as a negative answer are how
 * double charges happen, so this deliberately does not try to be clever about
 * 5xx: they are ambiguous, not negative.
 */
export function isServerRejection(error: unknown): boolean {
  return error instanceof ApiError && error.status >= 400 && error.status < 500;
}
