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

/**
 * Shown when the API answered with a 5xx, or with a body we cannot read.
 *
 * Deliberately does not claim the action failed. A 5xx can be raised *after* the
 * write committed — the sale route writes its audit entry after its RPC returns
 * — so "we do not know" is the honest answer, and a staff member who believes a
 * save failed will simply try it a second time.
 */
const UNCONFIRMED_CHANGE = 'The server could not confirm the change — refresh the page before trying again.';

/** The request never reached the API: a dropped connection, a timeout, a proxy. */
const UNREACHABLE_SERVER = 'The server could not be reached, so the change was not confirmed. Check your connection and try again.';

/**
 * Overrides for the two statuses whose generic treatment would mislead.
 *
 * Keyed on status rather than on the server's error `code` on purpose. Every
 * route already reports a specific reason in plain language, so re-deriving one
 * here would create a second copy to keep in sync — and a stale copy is worse
 * than none. These two are different: they describe the *session*, not the
 * request, and no route can say that about itself.
 */
const STATUS_MESSAGES: Record<number, string> = {
  401: 'Your session has expired. Sign in again, then retry.',
  403: 'You do not have permission to make that change. Ask an administrator.',
};

/**
 * Turns a caught failure into a sentence worth showing a staff member.
 *
 * Exists because five screens previously swallowed their failures outright, so
 * a refused save or delete produced no message at all. The rule it encodes is
 * the same one `isServerRejection` draws: a 4xx is a **verdict**, so the server's
 * own words are the most accurate thing available; anything else is an **open
 * question** and must be described as one.
 *
 * @param fallback Shown when a 4xx carries no usable message. Name the action
 *                 that failed, e.g. "The customer could not be deleted."
 */
export function describeApiError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return UNREACHABLE_SERVER;
  if (!isServerRejection(error)) return UNCONFIRMED_CHANGE;

  const statusMessage = STATUS_MESSAGES[error.status];
  if (statusMessage) return statusMessage;

  const serverMessage = readApiErrorBody(error)?.message?.trim();
  return serverMessage || fallback;
}
