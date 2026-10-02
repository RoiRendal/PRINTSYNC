-- Inventory item photos bucket.
--
-- Mirrors `20260915000000_storage_bucket.sql` (business logo) and
-- `20260910000900_design_asset_storage.sql` (design artwork): stock photos were
-- stored inline in `inventory_items.image_url` as a base64 data URL, written by
-- `InventoryFormModal` with a client-side `FileReader.readAsDataURL`. The list
-- endpoint selects `image_url` on every row, so every inventory fetch shipped
-- every photo's base64 — unnoticed only because the list never rendered it.
-- Uploads now go to Storage and only the resulting public URL is persisted.
--
-- Public read matches the other two buckets. Stock photos appear on staff-only
-- screens, so a private bucket would be stricter, but a signed URL expires and
-- the list stores one URL per row — every row would need re-signing on each
-- render. The object paths are unguessable UUIDs under the actor id, and the
-- photos are catalogue material, not customer data.
-- Writes go through the backend service role, which bypasses RLS, so no
-- insert/update/delete policy is granted to browser clients.
--
-- `file_size_limit` and `allowed_mime_types` are enforced by Storage itself, so
-- a request that slips past application validation is still rejected at the
-- bucket. They deliberately mirror `MAX_INVENTORY_IMAGE_BYTES` and the accepted
-- content types in `backend/src/services/inventoryAssetService.ts`.
--
-- No backfill: rows written before this migration hold a `data:` URL, which still
-- renders in an `<img>`, so existing photos keep working. They stay heavy in the
-- payload until the item is re-saved with a new photo.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inventory-assets',
  'inventory-assets',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "public can read inventory assets"
on storage.objects for select
using (bucket_id = 'inventory-assets');
