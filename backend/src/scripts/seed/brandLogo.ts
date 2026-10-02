/**
 * The shop's real brand logo, as shipped with the repository.
 *
 * This file used to live in the frontend's `public/` folder and be served at the
 * URL `/brand-logo.png`, with the backend generating a *second*, synthetic logo
 * (`businessLogo()` in `artwork.ts`) to seed `business_settings.logo_url`. Two
 * logos existed in two places and the database one won, so the owner's real
 * artwork never appeared in the app.
 *
 * The database is now the single source of truth: this PNG is uploaded once by
 * the demo seed and the resulting Storage URL is what every screen renders. The
 * frontend ships no logo at all.
 *
 * It lives under `backend/assets/` rather than the frontend because the seed is
 * the only consumer — the file is an input to a database write, not something a
 * browser fetches. Keeping it out of `public/` is also what stops it from being
 * re-introduced as a duplicate.
 */

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Repo root, resolved from this file.
 *
 * `src/scripts/seed/` -> up four levels is the repository root, which is the
 * same base `seedDemoData.ts` computes for its own dump folder.
 */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

/**
 * The shipped logo file.
 *
 * It is a **JPEG** despite having arrived in the repository as
 * `frontend/public/brand-logo.png` — the bytes start `FF D8 FF E0` (JFIF) and
 * always did. The extension was simply wrong, which nothing noticed because
 * every consumer from the bundler to the browser identifies an image by its
 * extension and then happily sniffs the real format.
 *
 * That is only harmless while nothing validates the type. The logo upload path
 * *does*: Storage serves the object back under whatever content type it was
 * stored with, so seeding these bytes as `image/png` would have published a JPEG
 * mislabelled as a PNG. The file was renamed rather than reconverted so the
 * owner's artwork is byte-for-byte what they supplied.
 */
export const BRAND_LOGO_ASSET_PATH = join(REPO_ROOT, 'backend', 'assets', 'brand-logo.jpg');

/**
 * Content type of the shipped logo.
 *
 * `image/jpeg`, matching the real bytes — not the `.png` the file used to claim.
 * Both this and `image/png` are on the frontend picker's allowlist and the
 * `business-assets` bucket's `allowed_mime_types`, so nothing had to be widened.
 */
export const BRAND_LOGO_CONTENT_TYPE = 'image/jpeg';
export const BRAND_LOGO_OBJECT_PATH = 'seed/brand-logo.jpg';
