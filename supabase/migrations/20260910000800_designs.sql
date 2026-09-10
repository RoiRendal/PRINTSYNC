create table public.designs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  category text not null default '',
  image_url text not null check (length(btrim(image_url)) > 0),
  tags text[] not null default '{}',
  asset_type text,
  asset_size_bytes integer check (asset_size_bytes is null or asset_size_bytes >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index designs_category_idx on public.designs(category);
create index designs_created_at_idx on public.designs(created_at desc);
create index designs_tags_idx on public.designs using gin(tags);

create trigger designs_set_updated_at
before update on public.designs
for each row execute function public.set_updated_at();

alter table public.designs enable row level security;

create policy "authenticated users can read designs"
on public.designs for select
to authenticated
using (true);

grant select on public.designs to authenticated;
grant select, insert, update, delete on public.designs to service_role;