import type { SupabaseClient } from '@supabase/supabase-js';
import type { BusinessSettings } from '@printsync/shared-types';
import { AppError } from '../../shared/errors.js';

export type { BusinessSettings };

export interface BusinessSettingsInput {
  businessName: string;
  logoUrl?: string | null | undefined;
  vatRate?: number | undefined;
  currencySymbol?: string | undefined;
}

function toSettings(row: Record<string, unknown>): BusinessSettings {
  return {
    businessName: String(row.business_name),
    logoUrl: row.logo_url ? String(row.logo_url) : null,
    vatRate: Number(row.vat_rate ?? 12),
    currencySymbol: String(row.currency_symbol ?? '₱'),
    updatedAt: String(row.updated_at),
  };
}

export async function getBusinessSettings(supabase: SupabaseClient): Promise<BusinessSettings> {
  const { data, error } = await supabase
    .from('business_settings')
    .select('business_name, logo_url, vat_rate, currency_symbol, updated_at')
    .eq('id', 1)
    .single();
  if (error || !data) throw new AppError(503, 'SETTINGS_LOOKUP_FAILED', 'Business settings could not be loaded.');
  return toSettings(data);
}

export async function updateBusinessSettings(
  supabase: SupabaseClient,
  input: BusinessSettingsInput,
  actorId: string,
): Promise<BusinessSettings> {
  const { data, error } = await supabase
    .from('business_settings')
    .update({
      business_name: input.businessName,
      logo_url: input.logoUrl ?? null,
      vat_rate: input.vatRate,
      currency_symbol: input.currencySymbol,
      updated_by: actorId,
    })
    .eq('id', 1)
    .select('business_name, logo_url, vat_rate, currency_symbol, updated_at')
    .single();
  if (error || !data) throw new AppError(400, 'SETTINGS_UPDATE_FAILED', 'Business settings could not be updated.');
  return toSettings(data);
}