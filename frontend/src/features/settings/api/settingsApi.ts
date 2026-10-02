import { apiClient, type ApiClient } from '../../../shared/api/client';
import type { BranchBranding, BusinessSettings, PublicBranding } from '@printsync/shared-types';

export type { BranchBranding, BusinessSettings, PublicBranding };

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
     *
     * ⚠ Branch-blind by design: it runs before anyone has a session, so it serves
     * one fixed shop's identity. Use it for the login screen, never to head a
     * receipt — after sign-in call `getBranchBranding` instead.
     */
    getPublicBranding: () => client.get<PublicBranding>('/branding'),
    /**
     * The signed-in caller's own branch identity: name, address, logo, VAT rate and
     * currency symbol.
     *
     * This is what the app header and every printed receipt use. The branch comes
     * from the session on the server, never from a parameter, so a client cannot ask
     * for another shop's identity — and cannot accidentally print one.
     */
    getBranchBranding: () => client.get<BranchBranding>('/branding/current'),
    getBusiness: () => client.get<BusinessSettings>('/settings'),
    /** Business name, address and defaults only — the logo has its own endpoints. */
    updateBusiness: (payload: { businessName: string; address?: string; vatRate?: number; currencySymbol?: string }) =>
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
