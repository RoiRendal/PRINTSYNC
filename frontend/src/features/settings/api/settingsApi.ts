import { apiClient, type ApiClient } from '../../../shared/api/client';

export interface BusinessSettings {
  businessName: string;
  logoUrl: string | null;
  updatedAt: string;
}

export function createSettingsApi(client: ApiClient = apiClient) {
  return {
    getBusiness: () => client.get<BusinessSettings>('/settings'),
    updateBusiness: (payload: { businessName: string; logoUrl?: string | null }) =>
      client.patch<BusinessSettings, typeof payload>('/settings', payload),
  };
}

export const settingsApi = createSettingsApi();