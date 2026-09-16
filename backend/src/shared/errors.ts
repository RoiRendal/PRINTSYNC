export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  /**
   * Optional machine-readable context, serialised into the error envelope and
   * surfaced as `ApiError.details` on the client.
   *
   * `message` is for the person reading the screen; this is for the code drawing
   * it. The insufficient-stock failure is the reason it exists — the cashier needs
   * to know *which* cart line is short, which a sentence alone cannot convey.
   */
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}
