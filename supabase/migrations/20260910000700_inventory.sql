create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique check (length(btrim(sku)) > 0),
  name text not null check (length(btrim(name)) > 0),
  category text not null default '',
  stock integer not null default 0 check (stock >= 0),
  reorder_level integer not null default 0 check (reorder_level >= 0),
  price numeric(12, 2) not null default 0 check (price >= 0),
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  quantity integer not null check (quantity <> 0),
  reason text not null check (length(btrim(reason)) > 0),
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index inventory_items_category_idx on public.inventory_items(category);
create index inventory_movements_item_created_idx on public.inventory_movements(inventory_item_id, created_at desc);

create trigger inventory_items_set_updated_at
before update on public.inventory_items
for each row execute function public.set_updated_at();

alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;

create policy "authenticated users can read inventory"
on public.inventory_items for select
to authenticated
using (true);

create policy "authenticated users can read inventory movements"
on public.inventory_movements for select
to authenticated
using (true);

grant select on public.inventory_items, public.inventory_movements to authenticated;
grant select, insert, update, delete on public.inventory_items, public.inventory_movements to service_role;

create or replace function public.adjust_inventory_stock(
  p_item_id uuid,
  p_quantity integer,
  p_reason text,
  p_actor_id uuid
)
returns public.inventory_items
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_item public.inventory_items;
begin
  if p_quantity = 0 or length(btrim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Invalid inventory movement';
  end if;

  update public.inventory_items
  set stock = stock + p_quantity
  where id = p_item_id
    and stock + p_quantity >= 0
  returning * into updated_item;

  if updated_item.id is null then
    raise exception 'Inventory item not found or stock cannot become negative';
  end if;

  insert into public.inventory_movements (inventory_item_id, quantity, reason, actor_id)
  values (p_item_id, p_quantity, btrim(p_reason), p_actor_id);

  return updated_item;
end;
$$;

revoke all on function public.adjust_inventory_stock(uuid, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.adjust_inventory_stock(uuid, integer, text, uuid) to service_role;