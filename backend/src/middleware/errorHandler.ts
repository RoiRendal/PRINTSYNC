import type { ErrorRequestHandler } from 'express';
import { AppError } from '../shared/errors.js';
import { logger } from '../shared/logger.js';

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  if (error?.type === 'entity.parse.failed') {
    response.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'The request body must contain valid JSON.',
      },
    });
    return;
  }

  // Raised by express.json() when the body exceeds the route's limit. Without this
  // branch an oversized upload would surface as a 500.
  if (error?.type === 'entity.too.large') {
    response.status(413).json({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'The request body is larger than this endpoint accepts.',
      },
    });
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
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        // Omitted rather than sent as `null` when absent, so the client can tell
        // "no structured context" from "context that happens to be null".
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    });
    return;
  }

  logger.error('Unhandled error', {
    name: error?.name,
    message: error?.message,
    stack: error?.stack,
    method: request.method,
    path: request.originalUrl,
  });
  response.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    },
  });
};
