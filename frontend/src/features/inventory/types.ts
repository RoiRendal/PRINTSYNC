export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  reorderLevel: number;
  price: number;
  imageUrl?: string;
}

export type CreateInventoryItem = Omit<InventoryItem, 'id'>;
export type UpdateInventoryItem = Partial<CreateInventoryItem>;
