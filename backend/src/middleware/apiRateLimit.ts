import type { Request } from 'express';
import rateLimit from 'express-rate-limit';

/** One minute. Long enough to smooth a burst, short enough to recover quickly. */
export const API_RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * The ceiling on how fast one client may use the API.
 *
 * ### The number comes from the frontend's traffic, not from feel
 *
 * The traffic is measurable, so it was measured:
 *
 *   - The event stream carries changes, so a healthy workstation makes a request
 *     only when something actually changed.
 *   - When the stream is down, `useDataRevalidation` polls every 60 s and each
 *     poll revalidates five domains — five requests a minute
 *     (`frontend/src/app/hooks/useDataRevalidation.ts:29,85`).
 *   - Focusing a tab revalidates the same five, with a 5 s cooldown.
 *
 * A busy workstation is therefore tens of requests a minute, not hundreds. The
 * number that matters is the shop rather than the workstation, because every
 * workstation sits behind one public address and so shares one bucket. Eight of
 * them at a deliberately pessimistic 60 requests a minute is under 500; this
 * ceiling is three times that.
 *
 * So the limit is not there to shape normal use — nothing legitimate comes close.
 * It is there to end a runaway: a client stuck in a retry loop, or a script
 * pointed at the API. Those do thousands of requests a minute, and 25 a second
 * stops one within seconds while leaving the shop untouched.
 *
 * If it ever does bite, the fix is this number. Raising it is cheap; the reason it
 * can be raised safely is that Render's edge, not this process, is what absorbs a
 * deliberate flood.
 */
export const API_RATE_LIMIT_MAX = 1_500;

/**
 * Paths that must never be counted, let alone refused.
 *
 *   - **`/api/v1/events`** is a stream, not a request. It is one connection held
 *     open for the life of the tab, so counting it would mean a workstation that
 *     keeps the POS open all day slowly exhausts its own budget for reconnecting
 *     — punishing exactly the client that is behaving correctly.
 *   - **`/api/v1/health`** and **`/api/v1/ready`** are polled by the platform, not
 *     by a person. A health check answered with `429` is a health check reporting
 *     the service as unhealthy, and Render is entitled to act on that by
 *     recycling the instance. The cost of refusing one is a restart loop; the cost
 *     of never counting one is nothing.
 */
const SKIPPED_PREFIXES = ['/api/v1/events', '/api/v1/health', '/api/v1/ready'];

/**
 * Whether this request is outside the limiter's remit.
 *
 * Reads `originalUrl`, not `path`: this middleware is mounted at `/api/v1`, and
 * Express rewrites `path` to strip the mount point, so `path` would be `/events`
 * and would never match.
 *
 * The prefix must end at a path boundary — end of string, `/`, or `?`. A plain
 * `startsWith` would also exempt `/api/v1/events-export` and any future route
 * whose name merely begins the same way, which is a quiet way to lose the ceiling
 * on a real endpoint. There is no such route today; the point is that adding one
 * should not silently disable the limiter on it.
 *
 * Exported because it is the part worth testing directly, and because a skip list
 * that stops matching is a silent failure — the limiter would simply start
 * counting the event stream and nobody would notice until a busy day.
 */
export function shouldSkipRateLimit(request: Pick<Request, 'originalUrl'>): boolean {
  return SKIPPED_PREFIXES.some((prefix) => {
    const { originalUrl } = request;
    if (!originalUrl.startsWith(prefix)) return false;
    const remainder = originalUrl.slice(prefix.length);
    return remainder === '' || remainder.startsWith('/') || remainder.startsWith('?');
  });
}

/**
 * A ceiling on how fast one client may use the API.
 *
 * Keyed on the client address, which is only a real address because `app.ts` sets
 * `trust proxy`. Without that every request would arrive from the load balancer
 * and the whole shop would share one bucket — the failure mode that made fixing
 * `trust proxy` (0bbda8c) a prerequisite for this.
 *
 * The existing login and refresh limiters stay as they are. They are far tighter
 * and answer a different question — "how many password guesses is one address
 * allowed" — and this limiter neither replaces nor weakens them.
 */
export const apiRateLimit = rateLimit({
  windowMs: API_RATE_LIMIT_WINDOW_MS,
  max: API_RATE_LIMIT_MAX,
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
