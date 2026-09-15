import { apiClient, type ApiClient } from '../../../shared/api/client';
import type { BusinessSettings } from '@printsync/shared-types';

export type { BusinessSettings };

export interface LogoUploadPayload {
  dataUrl: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export function createSettingsApi(client: ApiClient = apiClient) {
  return {
    getBusiness: () => client.get<BusinessSettings>('/settings'),
    /** Business name and defaults only — the logo has its own endpoints. */
    updateBusiness: (payload: { businessName: string; vatRate?: number; currencySymbol?: string }) =>
      client.patch<BusinessSettings, typeof payload>('/settings', payload),
    /**
     * Upload a logo to the `business-assets` bucket and persist its public URL.
     * Returns the updated settings, so the caller never has to follow up with a
     * separate write.
     */
    uploadLogo: (payload: LogoUploadPayload) => client.post<BusinessSettings, LogoUploadPayload>('/settings/logo', payload),
    /** Clear the stored URL and fall back to the bundled `/brand-logo.png`. */
    clearLogo: () => client.delete<BusinessSettings>('/settings/logo'),
  };
}

export const settingsApi = createSettingsApi();
