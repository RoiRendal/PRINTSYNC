export interface Design {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  createdAt: string;
  tags: string[];
}

export type CreateDesign = Omit<Design, 'id' | 'createdAt'>;
export type UpdateDesign = Partial<CreateDesign>;
