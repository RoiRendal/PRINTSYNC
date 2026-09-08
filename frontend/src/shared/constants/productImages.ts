import type { InventoryItem } from '../types/domain';

/**
 * Offline product thumbnails live under the Vite `public/` folder.
 *
 * On disk: `public/product-images/<SKU>.png` (e.g. `public/product-images/INV-001.png`)
 * In the app URL: `/product-images/INV-001.png`
 */
export function inventoryProductImagePublicUrl(inventoryId: InventoryItem['id']): string {
  return `/product-images/${inventoryId}.png`;
}
