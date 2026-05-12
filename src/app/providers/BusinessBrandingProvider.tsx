import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { BRAND_LOGO_URL, DEFAULT_BUSINESS_DISPLAY_NAME } from '../../shared/constants/branding';

const STORAGE_KEY = 'printsync-business-display-name';
const LOGO_STORAGE_KEY = 'printsync-business-logo-data-url';

const MAX_CUSTOM_LOGO_BYTES = 900_000;

type BusinessBrandingContextValue = {
  businessDisplayName: string;
  setBusinessDisplayName: (name: string) => void;
  /** File from `public/brand-logo.png` or a data URL saved from Settings. */
  effectiveBusinessLogoUrl: string;
  customBusinessLogoDataUrl: string | null;
  setCustomBusinessLogoDataUrl: (dataUrl: string | null) => void;
  maxCustomLogoBytes: number;
};

const BusinessBrandingContext = createContext<BusinessBrandingContextValue | null>(null);

function readStoredName(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_BUSINESS_DISPLAY_NAME;
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw == null || raw.trim() === '') {
    return DEFAULT_BUSINESS_DISPLAY_NAME;
  }
  return raw.trim();
}

function readStoredLogoDataUrl(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = localStorage.getItem(LOGO_STORAGE_KEY);
  if (raw == null || raw.trim() === '') {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed.startsWith('data:image/')) {
    return null;
  }
  return trimmed;
}

export function BusinessBrandingProvider({ children }: { children: React.ReactNode }) {
  const [businessDisplayName, setBusinessDisplayNameState] = useState(readStoredName);
  const [customBusinessLogoDataUrl, setCustomBusinessLogoDataUrlState] = useState<string | null>(readStoredLogoDataUrl);

  const setBusinessDisplayName = useCallback((name: string) => {
    const trimmed = name.trim();
    const next = trimmed === '' ? DEFAULT_BUSINESS_DISPLAY_NAME : trimmed;
    setBusinessDisplayNameState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const setCustomBusinessLogoDataUrl = useCallback((dataUrl: string | null) => {
    if (dataUrl == null || dataUrl === '') {
      localStorage.removeItem(LOGO_STORAGE_KEY);
      setCustomBusinessLogoDataUrlState(null);
      return;
    }
    localStorage.setItem(LOGO_STORAGE_KEY, dataUrl);
    setCustomBusinessLogoDataUrlState(dataUrl);
  }, []);

  const effectiveBusinessLogoUrl = customBusinessLogoDataUrl ?? BRAND_LOGO_URL;

  const value = useMemo(
    () => ({
      businessDisplayName,
      setBusinessDisplayName,
      effectiveBusinessLogoUrl,
      customBusinessLogoDataUrl,
      setCustomBusinessLogoDataUrl,
      maxCustomLogoBytes: MAX_CUSTOM_LOGO_BYTES,
    }),
    [businessDisplayName, setBusinessDisplayName, effectiveBusinessLogoUrl, customBusinessLogoDataUrl, setCustomBusinessLogoDataUrl],
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
