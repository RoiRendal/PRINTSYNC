import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../shared/errors.js';

export interface BusinessSettings {
  businessName: string;
  logoUrl: string | null;
  updatedAt: string;
}

export interface BusinessSettingsInput {
  businessName: string;
  logoUrl?: string | null | undefined;
}

function toSettings(row: Record<string, unknown>): BusinessSettings {
  return {
    businessName: String(row.business_name),
    logoUrl: row.logo_url ? String(row.logo_url) : null,
    updatedAt: String(row.updated_at),
  };
}

export async function getBusinessSettings(supabase: SupabaseClient): Promise<BusinessSettings> {
  const { data, error } = await supabase
    .from('business_settings')
    .select('business_name, logo_url, updated_at')
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
      updated_by: actorId,
    })
    .eq('id', 1)
    .select('business_name, logo_url, updated_at')
    .single();
  if (error || !data) throw new AppError(400, 'SETTINGS_UPDATE_FAILED', 'Business settings could not be updated.');
  return toSettings(data);
}