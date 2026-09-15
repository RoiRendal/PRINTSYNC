/** Internal product name (PRINTSYNC). */
export const APP_NAME = 'PRINTSYNC';

/**
 * Default company name shown in the header, reports, and exports.
 * Users can change this in Settings (persisted in `business_settings`).
 */
export const DEFAULT_BUSINESS_DISPLAY_NAME = 'IC Printing Services';

/**
 * Brand logo served from the Vite `public/` folder, used whenever no custom logo
 * has been uploaded.
 * Place your image file at: `public/brand-logo.png` (URL path `/brand-logo.png`).
 * Supported formats: png, jpg, svg, webp — if you use another name/extension, update this constant.
 */
export const BRAND_LOGO_URL = '/brand-logo.png';

/**
 * Image types accepted for a custom business logo.
 *
 * Mirrors `ALLOWED_IMAGE_CONTENT_TYPES` in `backend/src/services/imageAssetService.ts`
 * and the `allowed_mime_types` on the `business-assets` bucket. Duplicated here so
 * the file picker can reject an unsupported file without a round trip; the backend
 * and the bucket remain the authorities.
 */
export const BUSINESS_LOGO_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] as const;

/**
 * Ceiling for a custom business logo, in bytes.
 *
 * Mirrors `MAX_BUSINESS_LOGO_BYTES` in `backend/src/services/businessAssetService.ts`.
 * Logos render at ~64px, so 2 MB is generous while keeping the login screen light.
 */
export const MAX_BUSINESS_LOGO_BYTES = 2 * 1024 * 1024;
