import { apiClient, type ApiClient } from '../../../shared/api/client';
import type { CreateDesign, Design, UpdateDesign } from '../types';

export function createDesignsApi(client: ApiClient = apiClient) {
  return {
    uploadAsset: (payload: { dataUrl: string; fileName: string; contentType: string; sizeBytes: number }) =>
      client.post<{ imageUrl: string; assetType: string; assetSizeBytes: number }, typeof payload>('/designs/assets', payload),
    list: () => client.get<Design[]>('/designs'),
    create: (payload: CreateDesign) => client.post<Design, CreateDesign>('/designs', payload),
    update: (id: string, payload: UpdateDesign) => client.patch<Design, UpdateDesign>(`/designs/${id}`, payload),
    remove: (id: string) => client.delete<void>(`/designs/${id}`),
  };
}

export const designsApi = createDesignsApi();
