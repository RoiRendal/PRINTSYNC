-- Business assets bucket.
--
-- Business branding used to be stored inline in `business_settings.logo_url` as a
-- base64 data URL. A data URL is re-read on every settings fetch and ships the
-- whole image to the login screen, so uploads now go to Storage and only the
-- resulting public URL is persisted.
--
-- Mirrors `20260910000900_design_asset_storage.sql`: public bucket plus a public
-- read policy, because the logo is rendered on the unauthenticated login screen.
-- Writes go through the backend service role, which bypasses RLS, so no
-- insert/update/delete policy is granted to browser clients.
--
-- `file_size_limit` and `allowed_mime_types` are enforced by Storage itself, so a
-- request that slips past application validation is still rejected at the bucket.
-- They deliberately mirror `MAX_BUSINESS_LOGO_BYTES` and the accepted content
-- types in `backend/src/services/businessAssetService.ts`.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-assets',
  'business-assets',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "public can read business assets"
on storage.objects for select
using (bucket_id = 'business-assets');
