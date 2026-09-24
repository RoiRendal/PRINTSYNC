export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  stock: number;
  reorderLevel: number;
  price: number;
  costPrice: number;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * The payload the client sends to create an item.
 *
 * `sku` is optional-but-not-falsy: `sku?: string` would still be satisfied by
 * `''`, and the API rejects a blank one (`z.string().trim().min(1).optional()`),
 * so an empty string is not a permitted value — leaving the key out is how the
 * client asks the server to generate an SKU. Typing it as `sku?: string | null`
 * would be wrong here, because `null` is not a value the request schema accepts.
 */
export type CreateInventoryItem = Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt' | 'sku'> & {
  sku?: string;
};

export type UpdateInventoryItem = Partial<CreateInventoryItem>;
