/**
 * Offline design previews live under Vite `public/`.
 *
 * On disk: `public/design-images/<DesignId>.png` (e.g. `public/design-images/DSG-001.png`)
 * URL: `/design-images/DSG-001.png`
 *
 * Optional default when adding a design without an image URL:
 * `public/design-images/placeholder.png` → `/design-images/placeholder.png`
 *
 * There was a `designImagePublicUrl(designId)` helper here too. It had no callers
 * — designs carry their own image URL, and the bundled previews are reached by
 * literal path — so it is gone rather than kept as a second place for the shape
 * above to drift from.
 */
export const DEFAULT_NEW_DESIGN_IMAGE_URL = '/design-images/placeholder.png';
