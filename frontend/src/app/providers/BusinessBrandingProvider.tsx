import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
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
  /**
   * The shop's printed address for the signed-in branch, or `''` when none is set.
   *
   * Printed on every receipt and job ticket. Empty means the slip omits the line
   * rather than showing a gap. Before sign-in this is always `''` — the public
   * branding route deliberately does not carry an address, because the login screen
   * has no branch and has no receipt to print.
   */
  businessAddress: string;
  /**
   * Saves the printed address. Only the address column is written, so this cannot
   * disturb the name, VAT rate or logo.
   */
  setBusinessAddress: (address: string) => Promise<void>;
  /**
   * Hosted logo URL persisted in `business_settings.logo_url`, or `''` when the
   * shop has none.
   *
   * It is a plain string rather than `string | null` because the value goes
   * straight into an `<img src>`: an empty string makes the image render nothing
   * without a request, whereas `null` renders the string "null". Callers branch
   * on falsiness, which is both the render guard and the "no logo yet" guard.
   */
  businessLogoUrl: string;
  /** Uploads to Supabase Storage and persists the returned public URL. */
  uploadBusinessLogo: (file: File) => Promise<void>;
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
 * Only a hosted URL is renderable.
 *
 * Legacy rows stored the logo inline as a base64 data URL; those are no longer
 * rendered — they bloated every settings read and the login screen payload — so
 * anything that is not a hosted URL is treated as "no logo". There is no bundled
 * fallback any more: the database is the only source, so a rejected value leaves
 * the initials mark rather than a duplicate file.
 */
function toHostedLogoUrl(value: string | null): string {
  return value !== null && /^https?:\/\//.test(value) ? value : '';
}

export function BusinessBrandingProvider({ children }: { children: React.ReactNode }) {
  const [businessDisplayName, setBusinessDisplayNameState] = useState(DEFAULT_BUSINESS_DISPLAY_NAME);
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessLogoUrl, setBusinessLogoUrlState] = useState<string>('');
  const [vatRate, setVatRate] = useState(12);
  const [currencySymbol, setCurrencySymbol] = useState('₱');
  const [brandingError, setBrandingError] = useState<string | null>(null);
  const { currentUser } = useAuth();

  // Brand identity is public, so it is loaded once on mount regardless of whether
  // anyone is signed in. This is what lets the login screen render the uploaded
  // logo instead of the bundled fallback on a cold load.
  //
  // ⚠ This route is branch-blind by design (it runs before anyone has a session),
  // so it serves one shop's identity. It is the right answer for the login screen
  // and the WRONG answer for anything printed once somebody is signed in — hence
  // the second effect below, which overwrites these two values with the caller's
  // own branch as soon as a session exists.
  useEffect(() => {
    let mounted = true;
    void settingsApi.getPublicBranding()
      .then((branding) => {
        if (!mounted) return;
        setBusinessDisplayNameState(branding.businessName);
        setBusinessLogoUrlState(toHostedLogoUrl(branding.logoUrl));
        setBrandingError(null);
      })
      .catch((error: unknown) => {
        if (mounted) setBrandingError(error instanceof ApiError ? error.message : 'Business branding could not be loaded.');
      });
    return () => { mounted = false; };
  }, []);

  // The signed-in caller's own branch identity: name, address, logo and the
  // operational defaults.
  //
  // ### Why this replaced a `getBusiness()` call
  //
  // There used to be a second request here for the VAT rate and currency symbol,
  // and the NAME and LOGO were left at whatever the public route returned — which
  // is one fixed shop's identity. Every receipt printed anywhere therefore carried
  // that shop's name. Nothing looked broken, because in a single-branch business it
  // is indistinguishable from the truth.
  //
  // One request now answers the whole question, so there is no window in which the
  // name has been corrected but the address has not, and no way for the two reads
  // to disagree about which branch they describe.
  useEffect(() => {
    if (!currentUser) return;
    let mounted = true;
    void settingsApi.getBranchBranding()
      .then((branding) => {
        if (!mounted) return;
        setBusinessDisplayNameState(branding.businessName);
        setBusinessAddress(branding.address);
        setBusinessLogoUrlState(toHostedLogoUrl(branding.logoUrl));
        setVatRate(branding.vatRate);
        setCurrencySymbol(branding.currencySymbol);
        setBrandingError(null);
      })
      .catch((error: unknown) => {
        if (mounted) setBrandingError(error instanceof ApiError ? error.message : 'Business defaults could not be loaded.');
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

  /**
   * Saves the printed address.
   *
   * The business name is echoed back because the settings endpoint requires it —
   * it is a whole-record update, not a patch. `businessDisplayName` is therefore a
   * dependency, and the address is read from the response rather than assumed, so a
   * server-side trim is reflected instead of leaving the field showing the untrimmed
   * draft.
   */
  const setBusinessAddressCallback = useCallback(async (address: string) => {
    const settings = await settingsApi.updateBusiness({ businessName: businessDisplayName, address });
    setBusinessAddress(settings.address);
    setBrandingError(null);
  }, [businessDisplayName]);

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

  const value = useMemo(
    () => ({
      businessDisplayName,
      setBusinessDisplayName,
      businessAddress,
      setBusinessAddress: setBusinessAddressCallback,
      businessLogoUrl,
      uploadBusinessLogo,
      vatRate,
      setVatRate: setVatRateCallback,
      currencySymbol,
      setCurrencySymbol: setCurrencySymbolCallback,
      maxBusinessLogoBytes: MAX_BUSINESS_LOGO_BYTES,
      brandingError,
    }),
    [businessDisplayName, setBusinessDisplayName, businessAddress, setBusinessAddressCallback, businessLogoUrl, uploadBusinessLogo, vatRate, setVatRateCallback, currencySymbol, setCurrencySymbolCallback, brandingError],
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
