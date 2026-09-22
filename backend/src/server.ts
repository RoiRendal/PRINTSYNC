import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './shared/logger.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`PRINTSYNC API listening on http://localhost:${env.PORT}`, {
    environment: env.NODE_ENV,
    port: env.PORT,
  });
});

/**
 * How long a client may take to send the whole request — headers *and* body.
 *
 * ### Why this is not 30 seconds
 *
 * The obvious value is a tight one, and 30s is the number this started with. It
 * is wrong for this API, and the reason is in `app.ts`: an image upload is a JSON
 * body of up to 8 MB, because a 5 MB design asset arrives base64-encoded and
 * base64 is about a third larger than the bytes it carries. On a slow uplink that
 * body legitimately takes more than a minute to arrive, and a 30s ceiling would
 * abort real uploads from a shop on a weak connection — a failure that would look
 * like "the logo upload is broken" and be very hard to connect to this line.
 *
 * Two minutes still bounds the connection well below Node's five-minute default,
 * which is the point: a client that opens a socket and dribbles bytes forever can
 * hold a slot on a single Render instance, and a handful of them can exhaust it.
 *
 * The header timeout below is where the tight limit belongs, and it is tight.
 */
const REQUEST_TIMEOUT_MS = 120_000;

/**
 * How long a client may take to send the request headers.
 *
 * Headers are a few hundred bytes. A client that cannot produce them in 35
 * seconds is not a client — it is a slow-loris holding a connection open one byte
 * at a time, and this is the setting that ends it. It can be this tight precisely
 * because, unlike `requestTimeout`, it never has to accommodate a body.
 */
const HEADERS_TIMEOUT_MS = 35_000;

/**
 * How long an idle keep-alive connection is held open between requests.
 *
 * Node's default is 5 seconds, which is shorter than the idle timeout of most
 * proxies and load balancers — Render's included. When the proxy reuses a
 * connection this process has already closed, the client sees a spurious
 * "connection reset" on a request that should have worked. 65 seconds puts this
 * process on the longer side of the usual 60-second proxy timeout, which is the
 * conventional way to avoid that race.
 *
 * It does not affect the event stream: that connection is never idle, because it
 * carries a heartbeat every 25 seconds.
 */
const KEEP_ALIVE_TIMEOUT_MS = 65_000;

server.requestTimeout = REQUEST_TIMEOUT_MS;
server.headersTimeout = HEADERS_TIMEOUT_MS;
server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;

function shutdown(signal: string) {
  logger.info(`Received ${signal}, starting graceful shutdown`, { signal });

  server.close((error) => {
    if (error) {
      logger.error('Error during server close', { error: error.message });
      process.exit(1);
    }

    logger.info('HTTP server closed successfully');
    process.exit(0);
  });

  // Force exit after 10 seconds if connections don't drain
  setTimeout(() => {
    logger.warn('Forcing shutdown after timeout', { timeoutMs: 10_000 });
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
