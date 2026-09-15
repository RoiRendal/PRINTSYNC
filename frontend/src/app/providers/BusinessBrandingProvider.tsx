import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { BRAND_LOGO_URL, DEFAULT_BUSINESS_DISPLAY_NAME } from '../../shared/constants/branding';
import { settingsApi } from '../../features/settings/api/settingsApi';
import { ApiError } from '../../shared/api/errors';
import { useAuth } from '../../features/users/state/AuthContext';

const MAX_CUSTOM_LOGO_BYTES = 900_000;

type BusinessBrandingContextValue = {
  businessDisplayName: string;
  setBusinessDisplayName: (name: string) => Promise<void>;
  /** File from `public/brand-logo.png` or a data URL saved from Settings. */
  effectiveBusinessLogoUrl: string;
  customBusinessLogoDataUrl: string | null;
  setCustomBusinessLogoDataUrl: (dataUrl: string | null) => Promise<void>;
  vatRate: number;
  currencySymbol: string;
  maxCustomLogoBytes: number;
  brandingError: string | null;
};

const BusinessBrandingContext = createContext<BusinessBrandingContextValue | null>(null);

export function BusinessBrandingProvider({ children }: { children: React.ReactNode }) {
  const [businessDisplayName, setBusinessDisplayNameState] = useState(DEFAULT_BUSINESS_DISPLAY_NAME);
  const [customBusinessLogoDataUrl, setCustomBusinessLogoDataUrlState] = useState<string | null>(null);
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
        setCustomBusinessLogoDataUrlState(settings.logoUrl);
        setVatRate(settings.vatRate ?? 12);
        setCurrencySymbol(settings.currencySymbol ?? '₱');
        setBrandingError(null);
      })
      .catch((error: unknown) => {
        if (mounted) setBrandingError(error instanceof ApiError ? error.message : 'Business branding could not be loaded.');
      });
    return () => { mounted = false; };
  }, [currentUser]);

  const setBusinessDisplayName = useCallback(async (name: string) => {
    const trimmed = name.trim();
    const next = trimmed === '' ? DEFAULT_BUSINESS_DISPLAY_NAME : trimmed;
    const settings = await settingsApi.updateBusiness({ businessName: next, logoUrl: customBusinessLogoDataUrl });
    setBusinessDisplayNameState(next);
    setCustomBusinessLogoDataUrlState(settings.logoUrl);
    setBrandingError(null);
  }, [customBusinessLogoDataUrl]);

  const setCustomBusinessLogoDataUrl = useCallback(async (dataUrl: string | null) => {
    const settings = await settingsApi.updateBusiness({ businessName: businessDisplayName, logoUrl: dataUrl });
    setCustomBusinessLogoDataUrlState(settings.logoUrl);
    setBrandingError(null);
  }, [businessDisplayName]);

  const effectiveBusinessLogoUrl = customBusinessLogoDataUrl ?? BRAND_LOGO_URL;

  const value = useMemo(
    () => ({
      businessDisplayName,
      setBusinessDisplayName,
      effectiveBusinessLogoUrl,
      customBusinessLogoDataUrl,
      setCustomBusinessLogoDataUrl,
      vatRate,
      currencySymbol,
      maxCustomLogoBytes: MAX_CUSTOM_LOGO_BYTES,
      brandingError,
    }),
    [businessDisplayName, setBusinessDisplayName, effectiveBusinessLogoUrl, customBusinessLogoDataUrl, setCustomBusinessLogoDataUrl, vatRate, currencySymbol, brandingError],
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
