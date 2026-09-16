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
