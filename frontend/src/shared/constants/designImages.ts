import type { Design } from '../types/domain';

/**
 * Offline design previews live under Vite `public/`.
 *
 * On disk: `public/design-images/<DesignId>.png` (e.g. `public/design-images/DSG-001.png`)
 * URL: `/design-images/DSG-001.png`
 *
 * Optional default when adding a design without an image URL:
 * `public/design-images/placeholder.png` → `/design-images/placeholder.png`
 */
export function designImagePublicUrl(designId: Design['id']): string {
  return `/design-images/${designId}.png`;
}

export const DEFAULT_NEW_DESIGN_IMAGE_URL = '/design-images/placeholder.png';
