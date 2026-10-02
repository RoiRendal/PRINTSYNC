/**
 * What `designs.image_url` is allowed to hold.
 *
 * The design forms used to expose the stored value as a free-text field, so
 * whatever a staff member typed — or whatever a script posted straight to the
 * API — landed in a column the app later renders as an `<img src>` and hands to
 * `window.open` on three separate screens. `z.string().url()` did not stop it:
 * `new URL('javascript:alert(1)')` succeeds, so the dangerous schemes passed
 * validation and were stored.
 *
 * Only two shapes are legitimate, because those are the only two the app itself
 * ever produces:
 *
 *   - a bundled preview served by this app, written as a rooted path
 *     (`/design-images/placeholder.png`);
 *   - the public URL Supabase Storage returned for an uploaded asset, which is
 *     always on the configured project's own origin.
 *
 * Everything else — `javascript:`, `data:`, a protocol-relative `//host/...`,
 * or any third-party host — is refused at the edge of the API.
 */

/** Schemes accepted for an absolute image URL. */
const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

/**
 * True when `value` is a safe `designs.image_url`.
 *
 * `supabaseUrl` is the project's own API URL; an absolute URL is accepted only
 * when it shares that origin. When it is absent no absolute URL can be vouched
 * for, so only rooted paths pass — the route withdraws with 503 before anything
 * is written in that case anyway.
 */
export function isAllowedDesignImageUrl(value: string, supabaseUrl: string | undefined): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  // A rooted path on this app. `//host/x` is protocol-relative and resolves
  // against another origin, so a leading `//` is not a path; a bare `/` is the
  // app root, not an image.
  if (trimmed.startsWith('/')) return trimmed.length > 1 && !trimmed.startsWith('//');

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) return false;
  if (!supabaseUrl) return false;

  try {
    return new URL(supabaseUrl).origin === parsed.origin;
  } catch {
    return false;
  }
}
