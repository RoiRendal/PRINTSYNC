import { z } from 'zod';
import type { PaginationParams, PaginatedResponse } from '@printsync/shared-types';
import { AppError } from './errors.js';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export function parsePaginationQuery(query: unknown): PaginationParams {
  const parsed = paginationQuerySchema.safeParse(query);
  if (!parsed.success) {
    throw new AppError(400, 'INVALID_PAGINATION', 'Invalid pagination parameters.');
  }
  return parsed.data;
}

export function calculateRange(page: number, limit: number): { start: number; end: number } {
  const start = (page - 1) * limit;
  const end = start + limit - 1;
  return { start, end };
}

export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  return { data, total, page, limit };
}
