import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { authRouter } from './routes/auth.routes.js';
import { auditRouter } from './routes/audit.routes.js';
import { brandingRouter } from './routes/branding.routes.js';
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
import { eventsRouter } from './routes/events.routes.js';

/**
 * Routes that accept a base64 image in the request body.
 *
 * Keep in sync with the endpoints that call `uploadStorageImage`.
 */
const IMAGE_UPLOAD_PATHS = ['/api/v1/designs/assets', '/api/v1/settings/logo'];

/** Covers a 5 MB image (≈6.7 MB base64) plus the JSON envelope. */
const IMAGE_UPLOAD_JSON_LIMIT = '8mb';

/**
 * Where the built SPA lives, when this process is also serving it.
 *
 * ### Why the API serves the frontend at all
 *
 * PRINTSYNC authenticates with a cookie set to `SameSite=Lax`, which the browser
 * only returns to the *same site* that set it. Almost every free hosting platform
 * puts its default domain on the public suffix list, so two services such as
 * `printsync.onrender.com` and `printsync-api.onrender.com` are treated as
 * separate sites — login appears to succeed and then behaves as if signed out,
 * and the event stream fails with it. Serving both from one origin removes the
 * problem rather than working around it, and removes CORS along with it.
 *
 * ### Why it is optional
 *
 * In development the frontend runs on its own Vite dev server with a proxy, so
 * this resolves to nothing and the API stays a pure JSON service. Nothing about
 * local development changes.
 *
 * Returns `null` when there is no build to serve — the normal case in development
 * and in the backend test suite.
 */
function resolveFrontendDir(): string | null {
  // `backend/src/app.ts` in development, `backend/dist/app.js` once built — both
  // sit two levels below the repository root, so one relative path covers both.
  const defaultDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');
  const candidates = [env.FRONTEND_DIST, defaultDir].filter(
    (candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0,
  );

  // `index.html` is the marker rather than the directory itself: an empty or
  // half-written `dist/` is not something to serve, and serving nothing while
  // looking configured is how this turns into a confusing 404 report.
  return candidates.find((candidate) => existsSync(path.join(candidate, 'index.html'))) ?? null;
}

/**
 * Content Security Policy, merged over helmet's defaults.
 *
 * Only two defaults need changing once this process serves the SPA:
 *
 * - **`img-src`** defaults to `'self' data:`, which blocks every design asset and
 *   the business logo. Those are public URLs on the Supabase Storage host (see
 *   `getPublicUrl` in `services/imageAssetService.ts`), not paths on this origin.
 *   The failure mode is quiet — the page renders and the images are simply blank.
 * - **`upgrade-insecure-requests`** is only ever meaningful over plain HTTP, which
 *   means local testing. In production Render terminates TLS, so there is nothing
 *   to upgrade, and leaving it on locally makes the browser rewrite asset URLs to
 *   `https://localhost` and fail.
 *
 * `connect-src` is deliberately left at its default of `'self'`. The frontend
 * never calls Supabase directly — every read and write goes through this API — so
 * no second origin is legitimate for XHR or for the event stream.
 */
function contentSecurityPolicyDirectives() {
  const supabaseOrigin = env.SUPABASE_URL ? new URL(env.SUPABASE_URL).origin : null;

  return {
    imgSrc: ["'self'", 'data:', ...(supabaseOrigin ? [supabaseOrigin] : [])],
    upgradeInsecureRequests: env.NODE_ENV === 'production' ? [] : null,
  };
}

export function createApp() {
  const app = express();

  /**
   * Trust exactly one proxy hop — Render's load balancer, which is the only thing
   * that ever sits in front of this process (see `render.yaml`: one service, one
   * address).
   *
   * Without this, `request.ip` is the *proxy's* address for every request, so two
   * things silently stop working:
   *
   *   - `audit_logs.ip_address` records the load balancer for every actor, which
   *     makes the one field that could attribute an action to a person useless.
   *   - `express-rate-limit` counts every login attempt in the world against a
   *     single bucket, so ten wrong passwords anywhere lock out everyone.
   *
   * The value is the number `1`, not `true`. `true` trusts the whole
   * `X-Forwarded-For` chain, which lets a client prepend its own entry and choose
   * the address the limiter and the audit log see; `express-rate-limit` rejects
   * `true` outright as a permissive setting. One hop means Express reads exactly
   * the address Render appended and ignores anything the client sent.
   *
   * Consequence worth stating: this process must never be exposed directly. With
   * no proxy in front, a client could set the header itself and forge the address.
   */
  app.set('trust proxy', 1);

  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: { directives: contentSecurityPolicyDirectives() } }));
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
  // Public: the login screen needs the company name and logo before sign-in.
  app.use('/api/v1/branding', brandingRouter);
  app.use('/api/v1/auth', authRouter);
  // Server-sent events. Authenticated by the same session cookie as everything
  // else; each client only receives the domains it holds a read capability for.
  app.use('/api/v1/events', eventsRouter);
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

  // Registered after every API route and before `notFound`, so a request is only
  // treated as a page once it has failed to match an endpoint.
  const frontendDir = resolveFrontendDir();
  if (frontendDir) {
    app.use(
      express.static(frontendDir, {
        // Do not let a request for `/` be answered from here. The fallback below
        // handles it, and that is the one place the no-cache rule for the document
        // is applied.
        index: false,
        setHeaders(response, filePath) {
          if (filePath.endsWith('index.html')) {
            // Never cache the document. It is the only file whose name does not
            // change between releases, so a cached copy keeps loading the previous
            // bundle after a deploy and the fix looks like it did not ship.
            response.setHeader('Cache-Control', 'no-cache');
            return;
          }
          // Everything Vite emits under `/assets` carries a content hash in its
          // filename, so a given URL's bytes can never change.
          response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        },
      }),
    );

    app.use((request, response, next) => {
      if (request.method !== 'GET' && request.method !== 'HEAD') return next();
      // An unmatched `/api/...` path must fall through to `notFound` and answer
      // with the JSON error envelope. Handing it `index.html` would make a client
      // expecting JSON fail while parsing HTML, hiding the real 404 behind a
      // syntax error.
      if (request.path.startsWith('/api/')) return next();

      // Set before `sendFile`, not after: `sendFile` only supplies its own
      // `Cache-Control` when the header is absent, so setting it here is what
      // makes the rule stick. Without it the document is served as
      // `public, max-age=0` — harmless in practice, since the browser would
      // revalidate, but it is not the guarantee this is meant to make.
      response.setHeader('Cache-Control', 'no-cache');

      response.sendFile(path.join(frontendDir, 'index.html'), (error) => {
        if (!error) return;
        // The file passed the `existsSync` check at startup but could have gone
        // missing since. Fall through rather than half-sending a response.
        if (!response.headersSent) next();
      });
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
