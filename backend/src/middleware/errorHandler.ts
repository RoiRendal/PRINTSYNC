import type { ErrorRequestHandler } from 'express';
import { AppError } from '../shared/errors.js';
import { logger } from '../shared/logger.js';
import { currentRequestId } from '../shared/requestContext.js';

/**
 * Builds the error envelope.
 *
 * The request id is included because it is the one thing that makes a failure
 * actionable to somebody who is not reading the server logs. The response header
 * already carries it, but a header is invisible to a shop manager looking at an
 * error on screen; in the body it can be read out and it will find the exact
 * request, its log lines and its audit rows.
 *
 * `details` and `requestId` are omitted rather than sent as `null` when absent,
 * so a client can tell "nothing to say" from "a value that happens to be null".
 */
function errorBody(code: string, message: string, details?: unknown) {
  const requestId = currentRequestId();
  return {
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
      ...(requestId === null ? {} : { requestId }),
    },
  };
}

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  if (error?.type === 'entity.parse.failed') {
    response.status(400).json(errorBody('INVALID_JSON', 'The request body must contain valid JSON.'));
    return;
  }

  // Raised by express.json() when the body exceeds the route's limit. Without this
  // branch an oversized upload would surface as a 500.
  if (error?.type === 'entity.too.large') {
    response
      .status(413)
      .json(errorBody('PAYLOAD_TOO_LARGE', 'The request body is larger than this endpoint accepts.'));
    return;
  }

  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      logger.error('AppError thrown', {
        code: error.code,
        statusCode: error.statusCode,
        method: request.method,
        path: request.originalUrl,
      });
    }
    response.status(error.statusCode).json(errorBody(error.code, error.message, error.details));
    return;
  }

  logger.error('Unhandled error', {
    name: error?.name,
    message: error?.message,
    stack: error?.stack,
    method: request.method,
    path: request.originalUrl,
  });
  response.status(500).json(errorBody('INTERNAL_SERVER_ERROR', 'An unexpected error occurred.'));
};
