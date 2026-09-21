import { env } from '../config/env.js';
import { currentRequestId } from './requestContext.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const configuredLevel = LEVELS[env.LOG_LEVEL] ?? LEVELS.info;

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= configuredLevel;
}

/**
 * Writes one line, with the request id attached when there is one.
 *
 * The id is read from the request context here rather than passed by the caller,
 * which is the whole point: a log call cannot forget it, and every line written
 * while serving a request — including ones written by a service five frames down,
 * or by the error handler after something threw — is traceable to that request
 * without any of those call sites knowing the id exists.
 *
 * `meta` is spread last, so a caller that genuinely wants to record a *different*
 * id (a test, or a line about another request) still can.
 *
 * Outside a request there is no id and the field is simply absent, which is the
 * honest representation: `"requestId": null` on a startup line would suggest a
 * request that does not exist.
 */
function writeLog(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;
  const requestId = currentRequestId();
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(requestId === null ? {} : { requestId }),
    ...meta,
  };
  const output = JSON.stringify(entry);
  if (level === 'error' || level === 'warn') {
    process.stderr.write(output + '\n');
  } else {
    process.stdout.write(output + '\n');
  }
}

export const logger = {
  debug: (meta: Record<string, unknown>, message: string) => writeLog('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => writeLog('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => writeLog('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => writeLog('error', message, meta),
};
