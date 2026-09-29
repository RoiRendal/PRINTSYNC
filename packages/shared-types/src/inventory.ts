export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  stock: number;
  reorderLevel: number;
  price: number;
  costPrice: number;
  /**
   * Unit of measure, shown beside a price — `250.00 / pc`.
   *
   * A property of the ITEM, not of a sale line: a ream of paper is sold by the
   * ream. Non-null because the column is `not null default 'pc'`, so a row read
   * from the API always carries one.
   */
  uom: string;
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
 *
 * `uom` is omitted from the required set for the same reason `sku` is optional:
 * the column defaults to `'pc'` server-side, so a client that has not been taught
 * about units — including the demo seeder and any older caller — keeps working
 * and gets the default rather than a validation error.
 */
export type CreateInventoryItem = Omit<
  InventoryItem,
  'id' | 'createdAt' | 'updatedAt' | 'sku' | 'uom'
> & {
  sku?: string;
  uom?: string;
};

export type UpdateInventoryItem = Partial<CreateInventoryItem>;
