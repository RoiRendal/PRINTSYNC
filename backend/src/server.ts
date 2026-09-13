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
