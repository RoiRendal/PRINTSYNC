import type { Response } from 'express';

export function sendSuccess<T>(response: Response, data: T, status = 200) {
  return response.status(status).json({ data });
}
