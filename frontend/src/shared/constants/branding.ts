/** Internal product name (PRINTSYNC). */
export const APP_NAME = 'PRINTSYNC';

/**
 * Default company name shown in the header, reports, and exports.
 * Users can change this in Settings (persisted in `business_settings`).
 */
export const DEFAULT_BUSINESS_DISPLAY_NAME = 'IC Printing Services';

/**
 * Brand logo source.
 *
 * The logo is seeded into Supabase Storage and read from `business_settings`
 * (see the backend's `seed/brandLogo.ts`). The frontend deliberately ships **no**
 * bundled image: a fallback file would be a second copy that the database value
 * silently outranks, which is exactly the conflict this removed. A deployment
 * that cannot reach the stored URL therefore renders the initials mark below,
 * not a stale or duplicate logo.
 */

/**
 * Letters shown when no logo is available.
 *
 * Derived from the business name so the mark stays recognisable as the shop's —
 * "IC Printing Services" gives "IC". Two initials keep the mark legible at the
 * 20px the sidebar renders it at.
 */
export function businessInitials(businessName: string): string {
  const initials = businessName
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return initials || 'PS';
}

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
