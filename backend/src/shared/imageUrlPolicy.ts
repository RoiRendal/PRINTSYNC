/**
 * What a stored image URL is allowed to be.
 *
 * `designs.image_url` and `inventory_items.image_url` are both rendered as an
 * `<img src>`, and the design one is additionally handed to `window.open` on
 * three screens. Both used to accept any string the browser sent: the design
 * forms printed the stored value into a free-text box, and
 * `z.string().url()` — which was supposed to be the guard — does not help,
 * because `new URL('javascript:alert(1)')` succeeds. Both columns were
 * therefore open to `javascript:`, `data:`, a protocol-relative `//host/...`
 * and any third-party host.
 *
 * Only two shapes are legitimate, because those are the only two the app itself
 * ever produces:
 *
 *   - a rooted path served by this app (`/some/asset.png`) — kept accepted so a
 *     legacy row written under the old bundled-asset scheme still validates
 *     rather than having to be migrated. Nothing in the app writes one any more;
 *     the `design-images/` and `product-images/` folders that used to justify it
 *     were removed when it turned out twelve of their fourteen files were not
 *     the format their names claimed;
 *   - the public URL Supabase Storage returned for an uploaded asset, which is
 *     always on the configured project's own origin — the only shape the app
 *     produces today.
 *
 * Everything else is refused at the edge of the API. One rule, used by both
 * columns — a security check kept in two places is a check that drifts.
 */

/** Schemes accepted for an absolute image URL. */
const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

/**
 * True when `value` is a safe image URL to store.
 *
 * `supabaseUrl` is the project's own API URL; an absolute URL is accepted only
 * when it shares that origin. When it is absent no absolute URL can be vouched
 * for, so only rooted paths pass — the routes withdraw with 503 before anything
 * is written in that case anyway.
 */
export function isAllowedStoredImageUrl(value: string, supabaseUrl: string | undefined): boolean {
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
