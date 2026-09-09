import { apiClient, type ApiClient } from '../../../shared/api/client';
import type { Design } from '../types';

export type CreateDesign = Omit<Design, 'id' | 'createdAt'>;
export type UpdateDesign = Partial<CreateDesign>;

export function createDesignsApi(client: ApiClient = apiClient) {
  return {
    list: () => client.get<Design[]>('/designs'),
    create: (payload: CreateDesign) => client.post<Design, CreateDesign>('/designs', payload),
    update: (id: string, payload: UpdateDesign) => client.patch<Design, UpdateDesign>(`/designs/${id}`, payload),
    remove: (id: string) => client.delete<void>(`/designs/${id}`),
  };
}

export const designsApi = createDesignsApi();
