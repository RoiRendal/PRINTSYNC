/**
 * The width the stock gallery asks Storage for.
 *
 * A card's photo box measures **215px** at 1440px, so 400 covers a 2× display
 * with a little room. Measured on a real stock photo: the source is 963 KB and
 * the 400px render is 378 KB, a 61% saving per tile.
 */
export const GALLERY_THUMBNAIL_WIDTH = 400;

/** The public-object path Supabase Storage serves an original from. */
const OBJECT_PATH = '/storage/v1/object/public/';

/** The path that resizes on the way out, without touching the stored object. */
const RENDER_PATH = '/storage/v1/render/image/public/';

/**
 * How the transform fits the image into the requested width.
 *
 * **`resize` is not optional, and leaving it off is a visible bug.** With only
 * `width` given, Storage scales the width and leaves the HEIGHT untouched: a
 * 2000×3000 photo comes back as **400×3000** — the right file size and the wrong
 * picture, squashed to a quarter of its width. Measured on a real stock photo:
 *
 * | Request | Result | Bytes |
 * |---|---|---|
 * | `?width=400` | 400×3000 (distorted) | 378 KB |
 * | `?width=400&resize=contain` | 400×600 (correct) | **51 KB** |
 * | `?width=400&height=400&resize=cover` | 400×400 (square crop) | 49 KB |
 *
 * `contain` rather than `cover`: it keeps the whole picture and its shape, so
 * this stays safe to use anywhere, and the card's own `object-cover` produces
 * exactly the crop it produced before. `cover` would save 2.5% more bytes and
 * bake a square assumption into a general helper.
 */
const RESIZE_MODE = 'contain';

/**
 * Ask Supabase Storage for a smaller copy of an image.
 *
 * ### Why this exists
 *
 * The stock gallery drew full-size originals into 215px boxes — measured at
 * **21.8 megapixels across 15 tiles**, with sources up to 2000×3000. On a warm
 * cache that is invisible; on a shop connection it is a gallery that visibly
 * fills in, for pictures displayed at postage-stamp size.
 *
 * ### Why a URL rewrite and not a thumbnail pipeline
 *
 * Supabase resizes on the way out, so there is nothing to generate, store,
 * migrate or back-fill — the stored object is untouched and the original is
 * still what a download link serves. It is also free of a deploy: this is the
 * only change needed, and it applies to photos uploaded before it existed.
 *
 * ### What it deliberately does not touch
 *
 * Anything that is not a Supabase public object URL — a `data:` URL, another
 * host, or a URL already pointing at the render endpoint — is returned exactly
 * as it came in. A function that rewrites URLs it does not understand is how a
 * gallery ends up with broken images, and the caller cannot tell the difference
 * from a missing file.
 *
 * SVG passes through the render endpoint unchanged (verified: 200,
 * `image/svg+xml`, same bytes), so vector artwork is neither resized nor broken
 * by being sent through it.
 */
export function thumbnailUrl(
  url: string | null | undefined,
  width: number = GALLERY_THUMBNAIL_WIDTH,
): string | null {
  if (!url) return null;

  const marker = url.indexOf(OBJECT_PATH);
  // Not a Supabase public object URL. Leave it alone.
  if (marker === -1) return url;

  // Drop any existing query before adding the transform's own.
  const base = url.split('?')[0]!;
  const path = base.slice(marker + OBJECT_PATH.length);

  return `${base.slice(0, marker)}${RENDER_PATH}${path}?width=${width}&resize=${RESIZE_MODE}`;
}
