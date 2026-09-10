insert into storage.buckets (id, name, public)
values ('design-assets', 'design-assets', true)
on conflict (id) do update set public = excluded.public;

create policy "public can read design assets"
on storage.objects for select
using (bucket_id = 'design-assets');