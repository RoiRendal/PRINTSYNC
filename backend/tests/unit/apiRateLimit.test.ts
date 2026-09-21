import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { describe, it } from 'node:test';
import express from 'express';
import rateLimit from 'express-rate-limit';

import {
  API_RATE_LIMIT_MAX,
  API_RATE_LIMIT_WINDOW_MS,
  apiRateLimit,
  shouldSkipRateLimit,
} from '../../src/middleware/apiRateLimit.js';

/** Starts an app on an ephemeral port and returns a `fetch` base URL for it. */
async function listen(app: express.Express): Promise<{ server: Server; baseUrl: string }> {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  return { server, baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

async function close(server: Server): Promise<void> {
  await new Promise((resolve) => server.close(resolve));
}

/**
 * A miniature API carrying the limiter under test.
 *
 * The paths mirror the real mount points, because the skip list is expressed as
 * URL prefixes and the whole risk is that a prefix stops matching after a
 * refactor — which no unit test of a predicate would catch.
 */
function buildApp(limiter: express.RequestHandler): express.Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use('/api/v1', limiter);
  app.get('/api/v1/orders', (_request, response) => {
    response.json({ data: 'ok' });
  });
  app.get('/api/v1/events', (_request, response) => {
    response.json({ data: 'stream' });
  });
  app.get('/api/v1/health', (_request, response) => {
    response.json({ data: 'ok' });
  });
  return app;
}

describe('middleware/apiRateLimit', () => {
  describe('shouldSkipRateLimit', () => {
    const url = (originalUrl: string) => ({ originalUrl });

    it('skips the event stream, which is one connection rather than a request', () => {
      assert.equal(shouldSkipRateLimit(url('/api/v1/events')), true);
      // The query string must not defeat the match.
      assert.equal(shouldSkipRateLimit(url('/api/v1/events?domains=orders')), true);
    });

    it('skips the platform probes, so a health check can never be answered with 429', () => {
      assert.equal(shouldSkipRateLimit(url('/api/v1/health')), true);
      assert.equal(shouldSkipRateLimit(url('/api/v1/ready')), true);
    });

    it('counts ordinary API traffic', () => {
      assert.equal(shouldSkipRateLimit(url('/api/v1/orders')), false);
      assert.equal(shouldSkipRateLimit(url('/api/v1/auth/login')), false);
      // A path that merely starts with the same letters is not the stream.
      assert.equal(shouldSkipRateLimit(url('/api/v1/events-export')), false);
    });
  });

  describe('the configured limiter', () => {
    it('is mounted with the documented window and ceiling', async () => {
      const { server, baseUrl } = await listen(buildApp(apiRateLimit));
      try {
        const response = await fetch(`${baseUrl}/api/v1/orders`);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('ratelimit-limit'), String(API_RATE_LIMIT_MAX));
        assert.equal(API_RATE_LIMIT_WINDOW_MS, 60_000);
        assert.equal(API_RATE_LIMIT_MAX, 1_500);
      } finally {
        await close(server);
      }
    });

    it('does not count a skipped path at all', async () => {
      const { server, baseUrl } = await listen(buildApp(apiRateLimit));
      try {
        const response = await fetch(`${baseUrl}/api/v1/events`);
        assert.equal(response.status, 200);
        // No budget consumed, so no budget reported.
        assert.equal(response.headers.get('ratelimit-limit'), null);
        assert.equal(response.headers.get('ratelimit-remaining'), null);
      } finally {
        await close(server);
      }
    });
  });

  describe('refusing a client that will not slow down', () => {
    /**
     * The real options with a ceiling small enough to reach in a test. The window,
     * the skip predicate and the response shape are the production ones; only
     * `max` differs, because firing 1,501 requests to observe the real ceiling
     * would make the suite slow without testing anything the constant assertion
     * above does not already pin down.
     */
    const strictLimiter = rateLimit({
      windowMs: API_RATE_LIMIT_WINDOW_MS,
      max: 3,
      standardHeaders: true,
      legacyHeaders: false,
      skip: shouldSkipRateLimit,
      message: {
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please slow down and try again shortly.',
        },
      },
    });

    it('answers 429 with the code the frontend already understands', async () => {
      const { server, baseUrl } = await listen(buildApp(strictLimiter));
      try {
        const statuses: number[] = [];
        for (let attempt = 0; attempt < 4; attempt += 1) {
          statuses.push((await fetch(`${baseUrl}/api/v1/orders`)).status);
        }
        assert.deepEqual(statuses, [200, 200, 200, 429]);

        const refused = await fetch(`${baseUrl}/api/v1/orders`);
        const body = (await refused.json()) as { error: { code: string } };
        assert.equal(body.error.code, 'RATE_LIMITED');
      } finally {
        await close(server);
      }
    });

    it('never refuses a skipped path, however many times it is asked', async () => {
      // The failure this guards against is the platform probe being rate limited:
      // a health check answered with 429 reads as an unhealthy service, and Render
      // is entitled to act on that by recycling the instance.
      const { server, baseUrl } = await listen(buildApp(strictLimiter));
      try {
        for (const path of ['/api/v1/health', '/api/v1/events']) {
          for (let attempt = 0; attempt < 6; attempt += 1) {
            const response = await fetch(`${baseUrl}${path}`);
            assert.equal(response.status, 200, `${path} refused on attempt ${attempt + 1}`);
          }
        }
      } finally {
        await close(server);
      }
    });
  });
});
