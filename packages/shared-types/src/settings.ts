export interface BusinessSettings {
  businessName: string;
  logoUrl: string | null;
  vatRate: number;
  currencySymbol: string;
  updatedAt: string;
}

export type BusinessSettingsInput = Partial<Omit<BusinessSettings, 'updatedAt'>>;

/**
 * The subset of business settings that may be read *before* authentication.
 *
 * The login screen renders the company name and logo, so those two fields have to
 * be reachable without a session. Everything else in `BusinessSettings` is
 * operational configuration (VAT rate, currency symbol) and stays behind
 * `settings.read`.
 *
 * Kept as its own type rather than `Pick<BusinessSettings, ...>` so that adding a
 * field to `BusinessSettings` can never silently widen the public projection.
 */
export interface PublicBranding {
  businessName: string;
  logoUrl: string | null;
}
