import type { SupabaseClient } from '@supabase/supabase-js';
import type { BranchBranding, BusinessSettings, PublicBranding } from '@printsync/shared-types';
import { AppError } from '../../shared/errors.js';

export type { BranchBranding, BusinessSettings, PublicBranding };

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
  /**
   * The shop's printed address. Optional so a caller that only changes the VAT
   * rate does not have to echo it back — the update writes only the keys it was
   * sent, which is what stops a VAT-only save from blanking the address.
   */
  address?: string | undefined;
  vatRate?: number | undefined;
  currencySymbol?: string | undefined;
}

const SETTINGS_COLUMNS = 'branch_id, business_name, address, logo_url, vat_rate, currency_symbol, updated_at';

function toSettings(row: Record<string, unknown>): BusinessSettings {
  return {
    businessName: String(row.business_name),
    // `?? ''` rather than `String(...)`: a null from a row written before this
    // column existed must become an empty address, not the four-letter word
    // "null" printed in the middle of a customer's receipt.
    address: row.address ? String(row.address) : '',
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

/**
 * Brand identity for a **signed-in** caller: its own branch's name, address and
 * logo, plus the currency symbol and VAT rate the receipt needs.
 *
 * ### Why this exists separately from `getPublicBranding`
 *
 * The app used to take its header identity from the unauthenticated endpoint even
 * after sign-in, because that was the only branding read available. That endpoint
 * cannot know which branch is asking — it runs before anyone has a session — so it
 * falls back to one row, and every receipt therefore carried that one shop's name.
 * A sale at Nasugbu printed a Balayan header.
 *
 * The fix could not be "make `/branding` branch-aware": an unauthenticated route
 * that took a branch from the query string would let anyone enumerate branches, and
 * would still not answer the login screen's question (which branch *is* this?).
 * So there are two reads with two different questions, and this is the one that
 * runs once a branch is known.
 *
 * `branchId` is required rather than optional. There is no sensible fallback here:
 * the caller is authenticated and has a branch, so an absent branch is a bug
 * upstream, and silently substituting another shop's identity is the defect this
 * function exists to remove.
 */
export async function getBranchBranding(
  supabase: SupabaseClient,
  branchId: string,
): Promise<BranchBranding> {
  const { data, error } = await supabase
    .from('business_settings')
    .select('business_name, address, logo_url, vat_rate, currency_symbol')
    .eq('branch_id', branchId)
    .maybeSingle();

  if (error || !data) throw new AppError(503, 'BRANDING_LOOKUP_FAILED', 'Business branding could not be loaded.');
  return {
    businessName: String(data.business_name),
    address: data.address ? String(data.address) : '',
    logoUrl: data.logo_url ? String(data.logo_url) : null,
    vatRate: Number(data.vat_rate ?? 12),
    currencySymbol: String(data.currency_symbol ?? '₱'),
  };
}

export async function updateBusinessSettings(
  supabase: SupabaseClient,
  branchId: string,
  input: BusinessSettingsInput,
  actorId: string,
): Promise<BusinessSettings> {
  // Only the keys actually supplied are written. Passing an absent optional as
  // `undefined` to Supabase omits the column from the UPDATE, but building the
  // object literally is what makes that visible — and it is the same rule
  // `updateInventoryItem` learned the hard way, where a price-only save wiped the
  // stock photo. Here it would blank the printed address on a VAT-rate change.
  const patch: Record<string, unknown> = {
    business_name: input.businessName,
    updated_by: actorId,
  };
  if (input.address !== undefined) patch.address = input.address;
  if (input.vatRate !== undefined) patch.vat_rate = input.vatRate;
  if (input.currencySymbol !== undefined) patch.currency_symbol = input.currencySymbol;

  const { data, error } = await supabase
    .from('business_settings')
    .update(patch)
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
