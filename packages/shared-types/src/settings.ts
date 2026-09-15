export interface BusinessSettings {
  businessName: string;
  logoUrl: string | null;
  vatRate: number;
  currencySymbol: string;
  updatedAt: string;
}

export type BusinessSettingsInput = Partial<Omit<BusinessSettings, 'updatedAt'>>;
