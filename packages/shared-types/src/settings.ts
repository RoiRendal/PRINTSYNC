export interface BusinessSettings {
  businessName: string;
  /**
   * The shop's own address, printed on every receipt.
   *
   * It lives here rather than being read from `branches.address` because it is
   * *this* row's identity: a receipt must show where the sale happened, and the
   * settings row is already the thing the print path reads and is already
   * per-branch. Empty string means "not filled in yet" — the receipt simply omits
   * the line rather than printing a blank gap.
   */
  address: string;
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

/**
 * The brand identity a **signed-in** caller is shown, scoped to its own branch.
 *
 * This is what the app header *and every printed receipt* are headed with. It is
 * a wider projection than `PublicBranding` on purpose: a receipt also needs the
 * shop's address, the currency symbol and the VAT rate, and it must be the
 * printing branch's values or the slip is wrong.
 *
 * Kept separate from `BusinessSettings` rather than aliased to it because the two
 * answer different questions — `BusinessSettings` is an editable record (it has
 * `updatedAt`, and a settings screen may save it), this is a read-only projection
 * for display and printing. Naming them the same thing is how a display path ends
 * up accidentally writing.
 */
export interface BranchBranding {
  businessName: string;
  address: string;
  logoUrl: string | null;
  vatRate: number;
  currencySymbol: string;
}
