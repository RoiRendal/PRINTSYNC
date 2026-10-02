import { describe, it, expect } from 'vitest';
import { thumbnailUrl, GALLERY_THUMBNAIL_WIDTH } from './thumbnail';

const BUCKET = 'https://ucpkqamnoizfpyhxywnv.supabase.co';
const PHOTO = `${BUCKET}/storage/v1/object/public/design-assets/seed/products/app-cap-blk.png`;

describe('thumbnailUrl', () => {
  it('rewrites a Supabase object URL to the render endpoint', () => {
    expect(thumbnailUrl(PHOTO)).toBe(
      `${BUCKET}/storage/v1/render/image/public/design-assets/seed/products/app-cap-blk.png?width=400&resize=contain`,
    );
  });

  /*
   * The one that nearly shipped a broken gallery.
   *
   * Without `resize`, Storage scales the width and leaves the HEIGHT alone: a
   * 2000×3000 photo comes back 400×3000 — right file size, wrong picture,
   * squashed to a quarter of its width. Nothing errors, the bytes look great,
   * and the distortion is only visible on screen. Measured: `width=400` alone
   * returns 400×3000, while `width=400&resize=contain` returns 400×600.
   */
  it('always asks for proportional scaling, never width alone', () => {
    expect(thumbnailUrl(PHOTO)).toContain('resize=contain');
    expect(thumbnailUrl(PHOTO)).not.toMatch(/[?&]width=\d+$/);
  });

  it('uses the gallery width by default, and honours an explicit one', () => {
    expect(GALLERY_THUMBNAIL_WIDTH).toBe(400);
    expect(thumbnailUrl(PHOTO)).toContain('width=400');
    expect(thumbnailUrl(PHOTO, 800)).toContain('width=800');
  });

  it('keeps nested paths and the file name intact', () => {
    const nested = `${BUCKET}/storage/v1/object/public/inventory-assets/0b9be90f-d005-4422-9141-1b2e05389261/photo%20one.png`;
    expect(thumbnailUrl(nested)).toBe(
      `${BUCKET}/storage/v1/render/image/public/inventory-assets/0b9be90f-d005-4422-9141-1b2e05389261/photo%20one.png?width=400&resize=contain`,
    );
  });

  it('drops an existing query rather than stacking one', () => {
    expect(thumbnailUrl(`${PHOTO}?token=abc`)).toBe(
      `${BUCKET}/storage/v1/render/image/public/design-assets/seed/products/app-cap-blk.png?width=400&resize=contain`,
    );
  });

  it('leaves a URL that is already a render URL alone', () => {
    const already = `${BUCKET}/storage/v1/render/image/public/design-assets/x.png?width=200&resize=contain`;
    expect(thumbnailUrl(already)).toBe(already);
  });

  /*
   * The half that matters most. A rewrite function that touches URLs it does not
   * understand produces broken images that look exactly like missing files, so
   * every one of these must come back byte-identical.
   */
  it.each([
    ['another host', 'https://example.test/photo.png'],
    ['a data URL', 'data:image/png;base64,iVBORw0KGgo='],
    ['a same-origin path', '/uploads/legacy-photo.png'],
    ['a signed URL', `${BUCKET}/storage/v1/object/sign/design-assets/x.png?token=abc`],
    ['an unrelated Supabase path', `${BUCKET}/rest/v1/designs`],
  ])('returns %s unchanged', (_label, url) => {
    expect(thumbnailUrl(url)).toBe(url);
  });

  it('returns null for a missing photo, so the card draws its fallback', () => {
    expect(thumbnailUrl(null)).toBeNull();
    expect(thumbnailUrl(undefined)).toBeNull();
    expect(thumbnailUrl('')).toBeNull();
  });
});
