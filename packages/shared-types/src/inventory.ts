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

export type CreateInventoryItem = Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>;

export type UpdateInventoryItem = Partial<CreateInventoryItem>;
