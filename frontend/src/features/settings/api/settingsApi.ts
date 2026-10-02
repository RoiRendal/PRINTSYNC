import { apiClient, type ApiClient } from '../../../shared/api/client';
import type { BusinessSettings, PublicBranding } from '@printsync/shared-types';

export type { BusinessSettings, PublicBranding };

export interface LogoUploadPayload {
  dataUrl: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export function createSettingsApi(client: ApiClient = apiClient) {
  return {
    /**
     * Unauthenticated brand identity (company name + logo).
     *
     * Backed by the public `GET /branding` endpoint, so the login screen can render
     * the stored logo before anyone signs in. Only these two fields exist on the
     * response — VAT rate and currency symbol stay behind `GET /settings`.
     */
    getPublicBranding: () => client.get<PublicBranding>('/branding'),
    getBusiness: () => client.get<BusinessSettings>('/settings'),
    /** Business name and defaults only — the logo has its own endpoints. */
    updateBusiness: (payload: { businessName: string; vatRate?: number; currencySymbol?: string }) =>
      client.patch<BusinessSettings, typeof payload>('/settings', payload),
    /**
     * Upload a logo to the `business-assets` bucket and persist its public URL.
     * Returns the updated settings, so the caller never has to follow up with a
     * separate write.
     *
     * Upload is the only way to change the logo. There is no bundled fallback
     * file and no "reset" endpoint: the database holds the one logo the shop
     * has, so replacing it means uploading another.
     */
    uploadLogo: (payload: LogoUploadPayload) => client.post<BusinessSettings, LogoUploadPayload>('/settings/logo', payload),
  };
}

export const settingsApi = createSettingsApi();
