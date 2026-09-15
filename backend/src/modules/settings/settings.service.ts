import type { SupabaseClient } from '@supabase/supabase-js';
import type { BusinessSettings } from '@printsync/shared-types';
import { AppError } from '../../shared/errors.js';

export type { BusinessSettings };

/**
 * Fields the generic settings form owns.
 *
 * `logo_url` is deliberately absent: the logo is a Storage-backed URL now, so it
 * has its own writer (`setBusinessLogo`) instead of being re-sent on every save.
 * That removes the old coupling where editing the VAT rate had to echo the logo
 * back or silently wipe it.
 */
export interface BusinessSettingsInput {
  businessName: string;
  vatRate?: number | undefined;
  currencySymbol?: string | undefined;
}

const SETTINGS_COLUMNS = 'business_name, logo_url, vat_rate, currency_symbol, updated_at';

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
    .select(SETTINGS_COLUMNS)
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
      vat_rate: input.vatRate,
      currency_symbol: input.currencySymbol,
      updated_by: actorId,
    })
    .eq('id', 1)
    .select(SETTINGS_COLUMNS)
    .single();
  if (error || !data) throw new AppError(400, 'SETTINGS_UPDATE_FAILED', 'Business settings could not be updated.');
  return toSettings(data);
}

/**
 * The single writer for `logo_url`.
 *
 * Pass a Storage public URL after an upload, or `null` to fall back to the
 * bundled `/brand-logo.png`. Only the logo column is touched, so this can never
 * clobber a concurrent edit of the business name or defaults.
 */
export async function setBusinessLogo(
  supabase: SupabaseClient,
  logoUrl: string | null,
  actorId: string,
): Promise<BusinessSettings> {
  const { data, error } = await supabase
    .from('business_settings')
    .update({ logo_url: logoUrl, updated_by: actorId })
    .eq('id', 1)
    .select(SETTINGS_COLUMNS)
    .single();
  if (error || !data) throw new AppError(400, 'SETTINGS_UPDATE_FAILED', 'Business settings could not be updated.');
  return toSettings(data);
}