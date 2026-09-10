import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { authRouter } from './routes/auth.routes.js';
import { auditRouter } from './routes/audit.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { inventoryRouter } from './routes/inventory.routes.js';
import { designsRouter } from './routes/designs.routes.js';
import { ordersRouter } from './routes/orders.routes.js';
import { paymentsRouter } from './routes/payments.routes.js';
import { settingsRouter } from './routes/settings.routes.js';
import { analyticsRouter } from './routes/analytics.routes.js';
import { readyRouter } from './routes/ready.routes.js';
import { usersRouter } from './routes/users.routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/ready', readyRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/audit-logs', auditRouter);
  app.use('/api/v1/inventory', inventoryRouter);
  app.use('/api/v1/designs', designsRouter);
  app.use('/api/v1/orders', ordersRouter);
  app.use('/api/v1/payments', paymentsRouter);
  app.use('/api/v1/settings', settingsRouter);
  app.use('/api/v1/analytics', analyticsRouter);
  app.use('/api/v1/users', usersRouter);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
