import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { DEFAULT_BUSINESS_DISPLAY_NAME } from '../../shared/constants/branding';

const STORAGE_KEY = 'printsync-business-display-name';

type BusinessBrandingContextValue = {
  businessDisplayName: string;
  setBusinessDisplayName: (name: string) => void;
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

export function BusinessBrandingProvider({ children }: { children: React.ReactNode }) {
  const [businessDisplayName, setBusinessDisplayNameState] = useState(readStoredName);

  const setBusinessDisplayName = useCallback((name: string) => {
    const trimmed = name.trim();
    const next = trimmed === '' ? DEFAULT_BUSINESS_DISPLAY_NAME : trimmed;
    setBusinessDisplayNameState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo(
    () => ({ businessDisplayName, setBusinessDisplayName }),
    [businessDisplayName, setBusinessDisplayName],
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
