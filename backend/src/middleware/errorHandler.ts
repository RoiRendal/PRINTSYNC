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
