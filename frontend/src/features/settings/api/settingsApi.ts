import { apiClient, type ApiClient } from '../../../shared/api/client';
import type { BusinessSettings } from '@printsync/shared-types';

export type { BusinessSettings };

export function createSettingsApi(client: ApiClient = apiClient) {
  return {
    getBusiness: () => client.get<BusinessSettings>('/settings'),
    updateBusiness: (payload: { businessName: string; logoUrl?: string | null; vatRate?: number; currencySymbol?: string }) =>
      client.patch<BusinessSettings, typeof payload>('/settings', payload),
  };
}

export const settingsApi = createSettingsApi();