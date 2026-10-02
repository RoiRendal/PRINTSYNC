import type { SupabaseClient } from '@supabase/supabase-js';
import type { BusinessSettings, PublicBranding } from '@printsync/shared-types';
import { AppError } from '../../shared/errors.js';

export type { BusinessSettings, PublicBranding };

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

const SETTINGS_COLUMNS = 'branch_id, business_name, logo_url, vat_rate, currency_symbol, updated_at';

function toSettings(row: Record<string, unknown>): BusinessSettings {
  return {
    businessName: String(row.business_name),
    logoUrl: row.logo_url ? String(row.logo_url) : null,
    vatRate: Number(row.vat_rate ?? 12),
    currencySymbol: String(row.currency_symbol ?? '₱'),
    updatedAt: String(row.updated_at),
  };
}

/**
 * Business settings for one branch.
 *
 * ### Why every read is branch-scoped now
 *
 * `business_settings` used to be a singleton — `id = 1` enforced by a CHECK
 * constraint — so every query filtered on `id = 1` and it did not matter which
 * branch asked. Each branch owns its own row now (name, logo, VAT rate, currency,
 * time zone), so a read that is not scoped to a branch either returns the wrong
 * shop's identity or fails on `.single()` because two rows match. The branch is a
 * required argument rather than something read from a request, so no caller can
 * forget it.
 */
export async function getBusinessSettings(
  supabase: SupabaseClient,
  branchId: string,
): Promise<BusinessSettings> {
  const { data, error } = await supabase
    .from('business_settings')
    .select(SETTINGS_COLUMNS)
    .eq('branch_id', branchId)
    .single();
  if (error || !data) throw new AppError(503, 'SETTINGS_LOOKUP_FAILED', 'Business settings could not be loaded.');
  return toSettings(data);
}

/**
 * Brand identity for the unauthenticated login screen.
 *
 * Only `business_name` and `logo_url` are selected — the operational columns
 * (`vat_rate`, `currency_symbol`) are never read here, so they cannot leak even if
 * the mapping below is changed carelessly. The query stays narrow on purpose:
 * this is the one settings read that runs without a session.
 *
 * `branchId` is **optional**, and that is the deliberate answer to a real problem:
 * the login screen is rendered before anyone has signed in, so it cannot know
 * which branch the person belongs to. With no branch given this falls back to the
 * oldest settings row — Balayan, which arrives first in this schema's ordering and
 * holds the owner's real logo — so the company identity is always present rather
 * than blank. Once a branch is known (post-login, or when Phase 3 threads it
 * through), the branch's own name and logo are used.
 *
 * The alternative — a public endpoint that takes a branch id from the URL — would
 * let an unauthenticated caller enumerate branches, and would still not solve the
 * login screen's problem of not knowing the branch yet.
 */
export async function getPublicBranding(
  supabase: SupabaseClient,
  branchId?: string,
): Promise<PublicBranding> {
  const query = supabase
    .from('business_settings')
    .select('business_name, logo_url')
    .order('created_at', { ascending: true })
    .limit(1);

  const { data, error } = branchId
    ? await query.eq('branch_id', branchId).maybeSingle()
    : await query.maybeSingle();

  if (error || !data) throw new AppError(503, 'BRANDING_LOOKUP_FAILED', 'Business branding could not be loaded.');
  return {
    businessName: String(data.business_name),
    logoUrl: data.logo_url ? String(data.logo_url) : null,
  };
}

export async function updateBusinessSettings(
  supabase: SupabaseClient,
  branchId: string,
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
    .eq('branch_id', branchId)
    .select(SETTINGS_COLUMNS)
    .single();
  if (error || !data) throw new AppError(400, 'SETTINGS_UPDATE_FAILED', 'Business settings could not be updated.');
  return toSettings(data);
}

/**
 * The single writer for `logo_url`, for one branch.
 *
 * Pass a Storage public URL after an upload, or `null` for a branch with no logo.
 * Only the logo column is touched, so this can never clobber a concurrent edit of
 * the business name or defaults.
 *
 * `null` is no longer a "reset to the default logo" — there is no bundled logo
 * file any more, so it means the branch genuinely has none and the UI renders the
 * business initials. Nothing in the current app calls it with `null`; the
 * parameter stays because it is the only way to represent that state and a future
 * "remove logo" control would need it.
 */
export async function setBusinessLogo(
  supabase: SupabaseClient,
  branchId: string,
  logoUrl: string | null,
  actorId: string,
): Promise<BusinessSettings> {
  const { data, error } = await supabase
    .from('business_settings')
    .update({ logo_url: logoUrl, updated_by: actorId })
    .eq('branch_id', branchId)
    .select(SETTINGS_COLUMNS)
    .single();
  if (error || !data) throw new AppError(400, 'SETTINGS_UPDATE_FAILED', 'Business settings could not be updated.');
  return toSettings(data);
}
