import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  BRAND_LOGO_URL,
  DEFAULT_BUSINESS_DISPLAY_NAME,
  MAX_BUSINESS_LOGO_BYTES,
} from '../../shared/constants/branding';
import { readFileAsDataUrl } from '../../shared/lib/readFileAsDataUrl';
import { settingsApi } from '../../features/settings/api/settingsApi';
import { ApiError } from '../../shared/api/errors';
import { useAuth } from '../../app/stores/useAuthStore';

type BusinessBrandingContextValue = {
  businessDisplayName: string;
  setBusinessDisplayName: (name: string) => Promise<void>;
  /** Hosted logo URL persisted in `business_settings.logo_url`, or null when unset. */
  businessLogoUrl: string | null;
  /** Always renderable: the custom logo when set, otherwise the bundled asset. */
  effectiveBusinessLogoUrl: string;
  /** Uploads to Supabase Storage and persists the returned public URL. */
  uploadBusinessLogo: (file: File) => Promise<void>;
  /** Reverts to the bundled logo. */
  clearBusinessLogo: () => Promise<void>;
  vatRate: number;
  setVatRate: (rate: number) => Promise<void>;
  currencySymbol: string;
  setCurrencySymbol: (symbol: string) => Promise<void>;
  /** Client-side pre-check ceiling, mirrored by the backend and the bucket. */
  maxBusinessLogoBytes: number;
  brandingError: string | null;
};

const BusinessBrandingContext = createContext<BusinessBrandingContextValue | null>(null);

/**
 * Legacy rows stored the logo inline as a base64 data URL. Those are no longer
 * rendered — they bloated every settings read and the login screen payload — so
 * anything that is not a hosted URL is treated as unset and the bundled logo takes
 * over until the user uploads again.
 */
function toHostedLogoUrl(value: string | null): string | null {
  return value !== null && /^https?:\/\//.test(value) ? value : null;
}

export function BusinessBrandingProvider({ children }: { children: React.ReactNode }) {
  const [businessDisplayName, setBusinessDisplayNameState] = useState(DEFAULT_BUSINESS_DISPLAY_NAME);
  const [businessLogoUrl, setBusinessLogoUrlState] = useState<string | null>(null);
  const [vatRate, setVatRate] = useState(12);
  const [currencySymbol, setCurrencySymbol] = useState('₱');
  const [brandingError, setBrandingError] = useState<string | null>(null);
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser) return;
    let mounted = true;
    void settingsApi.getBusiness()
      .then((settings) => {
        if (!mounted) return;
        setBusinessDisplayNameState(settings.businessName);
        setBusinessLogoUrlState(toHostedLogoUrl(settings.logoUrl));
        setVatRate(settings.vatRate ?? 12);
        setCurrencySymbol(settings.currencySymbol ?? '₱');
        setBrandingError(null);
      })
      .catch((error: unknown) => {
        if (mounted) setBrandingError(error instanceof ApiError ? error.message : 'Business branding could not be loaded.');
      });
    return () => { mounted = false; };
  }, [currentUser]);

  // Every setter below writes only its own fields: the logo has a dedicated
  // endpoint, so a name or defaults save can no longer wipe it.

  const setBusinessDisplayName = useCallback(async (name: string) => {
    const trimmed = name.trim();
    const next = trimmed === '' ? DEFAULT_BUSINESS_DISPLAY_NAME : trimmed;
    const settings = await settingsApi.updateBusiness({ businessName: next });
    setBusinessDisplayNameState(next);
    setBusinessLogoUrlState(toHostedLogoUrl(settings.logoUrl));
    setBrandingError(null);
  }, []);

  const uploadBusinessLogo = useCallback(async (file: File) => {
    const dataUrl = await readFileAsDataUrl(file);
    const settings = await settingsApi.uploadLogo({
      dataUrl,
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    });
    setBusinessLogoUrlState(toHostedLogoUrl(settings.logoUrl));
    setBrandingError(null);
  }, []);

  const clearBusinessLogo = useCallback(async () => {
    const settings = await settingsApi.clearLogo();
    setBusinessLogoUrlState(toHostedLogoUrl(settings.logoUrl));
    setBrandingError(null);
  }, []);

  const setVatRateCallback = useCallback(async (rate: number) => {
    const settings = await settingsApi.updateBusiness({ businessName: businessDisplayName, vatRate: rate });
    setVatRate(settings.vatRate ?? 12);
    setBrandingError(null);
  }, [businessDisplayName]);

  const setCurrencySymbolCallback = useCallback(async (symbol: string) => {
    const settings = await settingsApi.updateBusiness({ businessName: businessDisplayName, currencySymbol: symbol });
    setCurrencySymbol(settings.currencySymbol ?? '₱');
    setBrandingError(null);
  }, [businessDisplayName]);

  const effectiveBusinessLogoUrl = businessLogoUrl ?? BRAND_LOGO_URL;

  const value = useMemo(
    () => ({
      businessDisplayName,
      setBusinessDisplayName,
      businessLogoUrl,
      effectiveBusinessLogoUrl,
      uploadBusinessLogo,
      clearBusinessLogo,
      vatRate,
      setVatRate: setVatRateCallback,
      currencySymbol,
      setCurrencySymbol: setCurrencySymbolCallback,
      maxBusinessLogoBytes: MAX_BUSINESS_LOGO_BYTES,
      brandingError,
    }),
    [businessDisplayName, setBusinessDisplayName, businessLogoUrl, effectiveBusinessLogoUrl, uploadBusinessLogo, clearBusinessLogo, vatRate, setVatRateCallback, currencySymbol, setCurrencySymbolCallback, brandingError],
  );

  return (
    <BusinessBrandingContext.Provider value={value}>
      {children}
    </BusinessBrandingContext.Provider>
  );
}

export function useBusinessBranding(): BusinessBrandingContextValue {
  const ctx = useContext(BusinessBrandingContext);
  if (!ctx) {
    throw new Error('useBusinessBranding must be used within BusinessBrandingProvider');
  }
  return ctx;
}
