create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer text not null check (length(btrim(customer)) > 0),
  status text not null default 'Pending' check (status in ('Pending', 'In Production', 'Ready for Pickup', 'Designing', 'Completed', 'Delivered')),
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  notes text not null default '',
  is_custom boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  design_id uuid references public.designs(id) on delete set null,
  name text not null check (length(btrim(name)) > 0),
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null default 0 check (unit_price >= 0)
);

create index orders_status_created_idx on public.orders(status, created_at desc);
create index orders_customer_idx on public.orders using gin(to_tsvector('simple', customer));
create index order_items_order_idx on public.order_items(order_id);

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "authenticated users can read orders"
on public.orders for select
to authenticated
using (true);

create policy "authenticated users can read order items"
on public.order_items for select
to authenticated
using (true);

grant select on public.orders, public.order_items to authenticated;
grant select, insert, update, delete on public.orders, public.order_items to service_role;

create or replace function public.create_order_with_items(
  p_customer text,
  p_status text,
  p_amount numeric,
  p_notes text,
  p_is_custom boolean,
  p_created_by uuid,
  p_items jsonb
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  created_order public.orders;
  item jsonb;
  inventory_id uuid;
  item_quantity integer;
  item_name text;
  item_price numeric;
begin
  if length(btrim(coalesce(p_customer, ''))) = 0 or p_amount < 0 or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Invalid order details';
  end if;

  insert into public.orders (customer, status, amount, notes, is_custom, created_by)
  values (btrim(p_customer), coalesce(p_status, 'Pending'), coalesce(p_amount, 0), coalesce(p_notes, ''), coalesce(p_is_custom, false), p_created_by)
  returning * into created_order;

  for item in select * from jsonb_array_elements(p_items)
  loop
    inventory_id := nullif(item->>'itemId', '')::uuid;
    item_quantity := (item->>'quantity')::integer;
    item_name := btrim(item->>'name');
    item_price := coalesce((item->>'unitPrice')::numeric, 0);

    if item_quantity is null or item_quantity <= 0 or item_name = '' or item_price < 0 then
      raise exception 'Invalid order item';
    end if;

    if inventory_id is not null then
      update public.inventory_items
      set stock = stock - item_quantity
      where id = inventory_id and stock >= item_quantity;
      if not found then
        raise exception 'Inventory item is unavailable or stock is insufficient';
      end if;
    end if;

    insert into public.order_items (order_id, inventory_item_id, design_id, name, quantity, unit_price)
    values (created_order.id, inventory_id, nullif(item->>'designId', '')::uuid, item_name, item_quantity, item_price);
  end loop;

  return created_order;
end;
$$;

revoke all on function public.create_order_with_items(text, text, numeric, text, boolean, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_order_with_items(text, text, numeric, text, boolean, uuid, jsonb) to service_role;
