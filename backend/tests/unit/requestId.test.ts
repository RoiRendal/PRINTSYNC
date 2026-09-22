import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { after, before, describe, it } from 'node:test';
import express from 'express';

import { createApp } from '../../src/app.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { REQUEST_ID_HEADER, requestId } from '../../src/middleware/requestId.js';
import { AppError } from '../../src/shared/errors.js';
import { logger } from '../../src/shared/logger.js';
import { currentRequestContext, currentRequestId, runWithRequestContext } from '../../src/shared/requestContext.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Captures what the logger writes.
 *
 * `logger.error` is used rather than `logger.info` wherever this is asserted on,
 * on purpose: `error` is the highest level and therefore the only one that is
 * always emitted whatever `LOG_LEVEL` is set to. The tests here are about what a
 * line *contains*, not about which lines get filtered out.
 */
function captureLogs(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const originalOut = process.stdout.write;
  const originalErr = process.stderr.write;

  const capture = (chunk: unknown): boolean => {
    lines.push(String(chunk));
    return true;
  };

  process.stdout.write = capture as unknown as typeof process.stdout.write;
  process.stderr.write = capture as unknown as typeof process.stderr.write;

  return {
    lines,
    restore: () => {
      process.stdout.write = originalOut;
      process.stderr.write = originalErr;
    },
  };
}

/**
 * A miniature app carrying the real middleware, the real error handler and the
 * real request context.
 *
 * Deliberately a real server rather than a direct call to the middleware. The
 * risky part of this feature is not the id generation — it is whether
 * `AsyncLocalStorage` actually survives the hop from the middleware through
 * Express's own async plumbing into a route handler. A test that invoked the
 * middleware directly would assert the happy path of the one thing that cannot
 * break, and say nothing about the thing that can.
 */
function buildApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(requestId);

  app.get('/context', (_request, response) => {
    response.json({ data: currentRequestContext() ?? null });
  });

  app.get('/boom', () => {
    throw new AppError(500, 'BOOM', 'It broke.');
  });

  app.use(errorHandler);
  return app;
}

describe('middleware/requestId', () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    server = buildApp().listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('mints an id when the caller sends none, and returns it in the header', async () => {
    const response = await fetch(`${baseUrl}/context`);
    const header = response.headers.get(REQUEST_ID_HEADER);
    const body = (await response.json()) as { data: { requestId: string } };

    assert.match(header ?? '', UUID_PATTERN);
    assert.equal(body.data.requestId, header);
  });

  it('adopts a plausible caller-supplied id, so a trace can be started upstream', async () => {
    const response = await fetch(`${baseUrl}/context`, {
      headers: { [REQUEST_ID_HEADER]: 'checkout-4f21a' },
    });
    const body = (await response.json()) as { data: { requestId: string } };

    assert.equal(response.headers.get(REQUEST_ID_HEADER), 'checkout-4f21a');
    assert.equal(body.data.requestId, 'checkout-4f21a');
  });

  it('trims a supplied id before using it', async () => {
    const response = await fetch(`${baseUrl}/context`, {
      headers: { [REQUEST_ID_HEADER]: '  spaced-id  ' },
    });

    assert.equal(response.headers.get(REQUEST_ID_HEADER), 'spaced-id');
  });

  it('replaces a blank id rather than echoing nothing', async () => {
    const response = await fetch(`${baseUrl}/context`, {
      headers: { [REQUEST_ID_HEADER]: '    ' },
    });

    assert.match(response.headers.get(REQUEST_ID_HEADER) ?? '', UUID_PATTERN);
  });

  it('replaces an oversized id, so a header cannot bloat every log line and audit row', async () => {
    const response = await fetch(`${baseUrl}/context`, {
      headers: { [REQUEST_ID_HEADER]: 'x'.repeat(129) },
    });

    assert.match(response.headers.get(REQUEST_ID_HEADER) ?? '', UUID_PATTERN);
  });

  it('replaces an id containing control characters, so it cannot forge a log entry', async () => {
    const response = await fetch(`${baseUrl}/context`, {
      headers: { [REQUEST_ID_HEADER]: 'ok\tforged' },
    });
    const minted = response.headers.get(REQUEST_ID_HEADER) ?? '';

    assert.notEqual(minted, 'ok\tforged');
    assert.match(minted, UUID_PATTERN);
  });

  it('keeps a valid client address, which is only real because `trust proxy` is set', async () => {
    const response = await fetch(`${baseUrl}/context`, {
      headers: { 'x-forwarded-for': '203.0.113.9', 'user-agent': 'till/1.0' },
    });
    const body = (await response.json()) as { data: { ipAddress: string | null; userAgent: string | null } };

    assert.equal(body.data.ipAddress, '203.0.113.9');
    assert.equal(body.data.userAgent, 'till/1.0');
  });

  it('drops a forged address instead of letting it break the request that carries it', async () => {
    // `audit_logs.ip_address` is `inet`, and the money RPCs now write their audit
    // row inside the transaction — so an uncastable value would roll back a sale.
    // A forged `X-Forwarded-For` must therefore cost the audit row its address and
    // nothing more.
    const response = await fetch(`${baseUrl}/context`, {
      headers: { 'x-forwarded-for': 'not-an-address' },
    });
    const body = (await response.json()) as { data: { ipAddress: string | null } };

    assert.equal(response.status, 200);
    assert.equal(body.data.ipAddress, null);
  });

  it('reports the id on an error response, so a failure can be quoted back', async () => {
    const response = await fetch(`${baseUrl}/boom`, {
      headers: { [REQUEST_ID_HEADER]: 'failed-sale-1' },
    });
    const body = (await response.json()) as { error: { code: string; requestId?: string } };

    assert.equal(response.status, 500);
    assert.equal(body.error.code, 'BOOM');
    assert.equal(body.error.requestId, 'failed-sale-1');
  });

  it('leaves the error envelope unchanged when there is no request id to report', () => {
    // The envelope is also built for errors raised outside a request context. The
    // field must then be absent rather than present and null.
    assert.equal(currentRequestId(), null);
  });
});

describe('shared/logger request id enrichment', () => {
  it('adds the request id to every line written while serving a request', () => {
    const captured = captureLogs();
    try {
      runWithRequestContext({ requestId: 'req-abc', ipAddress: null, userAgent: null }, () => {
        logger.error('something happened');
      });
    } finally {
      captured.restore();
    }

    const entry = JSON.parse(captured.lines.join('')) as Record<string, unknown>;
    assert.equal(entry.requestId, 'req-abc');
    assert.equal(entry.message, 'something happened');
  });

  it('omits the field outside a request rather than writing a null id', () => {
    const captured = captureLogs();
    try {
      logger.error('startup line');
    } finally {
      captured.restore();
    }

    const entry = JSON.parse(captured.lines.join('')) as Record<string, unknown>;
    assert.equal('requestId' in entry, false);
  });
});

describe('app wiring', () => {
  it('registers the middleware, so the id is present on every response the API serves', async () => {
    // The unit tests above prove the middleware works. This proves it is actually
    // installed in `createApp()` — and, because `createApp` builds the whole route
    // tree, that nothing registered ahead of it shadows it.
    const server = createApp().listen(0);
    try {
      await new Promise((resolve) => server.once('listening', resolve));
      const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

      const response = await fetch(`${baseUrl}/api/v1/health`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get(REQUEST_ID_HEADER) ?? '', UUID_PATTERN);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
