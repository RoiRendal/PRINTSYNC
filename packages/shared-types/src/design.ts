export interface Design {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  assetType: string | null;
  assetSizeBytes: number | null;
}

export type CreateDesign = Omit<Design, 'id' | 'createdAt' | 'updatedAt'>;

export type UpdateDesign = Partial<CreateDesign>;
