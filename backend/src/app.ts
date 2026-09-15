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
import { customersRouter } from './routes/customers.routes.js';
import { orderPaymentsRouter } from './routes/orderPayments.routes.js';
import { suppliersRouter } from './routes/suppliers.routes.js';
import { expensesRouter } from './routes/expenses.routes.js';
import { exportRouter } from './routes/export.routes.js';

/**
 * Routes that accept a base64 image in the request body.
 *
 * Keep in sync with the endpoints that call `uploadStorageImage`.
 */
const IMAGE_UPLOAD_PATHS = ['/api/v1/designs/assets', '/api/v1/settings/logo'];

/** Covers a 5 MB image (≈6.7 MB base64) plus the JSON envelope. */
const IMAGE_UPLOAD_JSON_LIMIT = '8mb';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }));

  // Image uploads arrive as a base64 data URL inside a JSON body, and base64 is
  // roughly a third larger than the bytes it encodes. A 5 MB design asset is
  // therefore a ~6.7 MB request, which the default 1 MB parser would reject with a
  // 413 before the route ever runs. These paths get a parser with a ceiling that
  // matches the service-level limits; every other route keeps the 1 MB default so
  // the DoS surface is unchanged.
  //
  // Registered before the global parser because body-parser skips a request whose
  // body has already been read (`req._body`), so the first parser to run wins.
  app.use(IMAGE_UPLOAD_PATHS, express.json({ limit: IMAGE_UPLOAD_JSON_LIMIT }));
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
  app.use('/api/v1/customers', customersRouter);
  app.use('/api/v1/order-payments', orderPaymentsRouter);
  app.use('/api/v1/suppliers', suppliersRouter);
  app.use('/api/v1/expenses', expensesRouter);
  app.use('/api/v1/export', exportRouter);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
