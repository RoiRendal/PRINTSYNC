import { Router } from 'express';
import { sendSuccess } from '../shared/apiResponse.js';

export const healthRouter = Router();

healthRouter.get('/', (_request, response) => {
  sendSuccess(response, {
    status: 'ok',
    service: 'printsync-api',
    timestamp: new Date().toISOString(),
  });
});
