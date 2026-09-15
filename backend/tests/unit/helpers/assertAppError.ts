import assert from 'node:assert/strict';
import { AppError } from '../../../src/shared/errors.js';

/**
 * Asserts that `run()` rejects with an `AppError` carrying the expected status
 * and code, and returns it so a test can inspect the message too.
 */
export async function assertAppError(
  run: () => Promise<unknown>,
  statusCode: number,
  code: string,
  messageIncludes?: string,
): Promise<AppError> {
  let error: unknown;
  try {
    await run();
  } catch (thrown: unknown) {
    error = thrown;
  }

  assert.ok(error instanceof AppError, `Expected an AppError, received: ${String(error)}`);
  assert.equal(error.statusCode, statusCode, `Expected HTTP ${statusCode} for ${code}`);
  assert.equal(error.code, code);
  if (messageIncludes !== undefined) {
    assert.ok(
      error.message.includes(messageIncludes),
      `Expected message to include "${messageIncludes}", received "${error.message}"`,
    );
  }
  return error;
}

/** Asserts that `run()` resolves without throwing. */
export async function assertResolves(run: () => Promise<unknown>): Promise<void> {
  await assert.doesNotReject(run);
}
