export interface InventoryItem {
  id: string;
  sku?: string;
  name: string;
  category: string;
  stock: number;
  reorderLevel: number;
  price: number;
  imageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type CreateInventoryItem = Omit<InventoryItem, 'id'>;
export type UpdateInventoryItem = Partial<CreateInventoryItem>;
