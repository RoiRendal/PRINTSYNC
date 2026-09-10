insert into public.permissions (key, description)
values
  ('payments.read', 'View payment and transaction records'),
  ('payments.create', 'Record completed payments and transactions'),
  ('payments.void', 'Void completed payment transactions')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
join public.permissions on permissions.key in ('payments.read', 'payments.create', 'payments.void')
where roles.name = 'admin'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
join public.permissions on permissions.key in ('payments.read', 'payments.create')
where roles.name = 'staff'
on conflict do nothing;

create table public.sales_transactions (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'completed' check (status in ('completed', 'voided')),
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  tax numeric(12, 2) not null default 0 check (tax >= 0),
  total numeric(12, 2) not null check (total >= 0),
  payment_method text not null check (payment_method in ('Cash', 'Card', 'Custom Order')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users(id) on delete set null
);

create table public.sales_transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.sales_transactions(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  name text not null check (length(btrim(name)) > 0),
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.sales_transactions(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  method text not null check (method in ('Cash', 'Card', 'Custom Order')),
  status text not null default 'captured' check (status in ('captured', 'voided')),
  received_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  voided_at timestamptz
);

create index sales_transactions_created_idx on public.sales_transactions(created_at desc);
create index sales_transactions_status_idx on public.sales_transactions(status);
create index sales_transaction_items_transaction_idx on public.sales_transaction_items(transaction_id);
create index payments_transaction_idx on public.payments(transaction_id);

alter table public.sales_transactions enable row level security;
alter table public.sales_transaction_items enable row level security;
alter table public.payments enable row level security;

create policy "authenticated users can read transactions"
on public.sales_transactions for select
to authenticated
using (true);

create policy "authenticated users can read transaction items"
on public.sales_transaction_items for select
to authenticated
using (true);

create policy "authenticated users can read payments"
on public.payments for select
to authenticated
using (true);

grant select on public.sales_transactions, public.sales_transaction_items, public.payments to authenticated;
grant select, insert, update, delete on public.sales_transactions, public.sales_transaction_items, public.payments to service_role;

create or replace function public.create_transaction_with_payment(
  p_subtotal numeric,
  p_discount numeric,
  p_tax numeric,
  p_total numeric,
  p_payment_method text,
  p_received_amount numeric,
  p_created_by uuid,
  p_items jsonb
)
returns public.sales_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  created_transaction public.sales_transactions;
  item jsonb;
  inventory_id uuid;
  item_quantity integer;
  item_name text;
  item_price numeric;
begin
  if p_subtotal < 0 or p_discount < 0 or p_tax < 0 or p_total < 0
    or p_payment_method not in ('Cash', 'Card', 'Custom Order')
    or p_received_amount <= 0
    or p_received_amount <> p_total
    or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Invalid transaction details';
  end if;

  insert into public.sales_transactions (subtotal, discount, tax, total, payment_method, created_by)
  values (p_subtotal, p_discount, p_tax, p_total, p_payment_method, p_created_by)
  returning * into created_transaction;

  for item in select * from jsonb_array_elements(p_items)
  loop
    inventory_id := nullif(item->>'itemId', '')::uuid;
    item_quantity := (item->>'quantity')::integer;
    item_name := btrim(item->>'name');
    item_price := coalesce((item->>'unitPrice')::numeric, 0);

    if item_quantity is null or item_quantity <= 0 or item_name = '' or item_price < 0 then
      raise exception 'Invalid transaction item';
    end if;

    if inventory_id is not null then
      update public.inventory_items
      set stock = stock - item_quantity
      where id = inventory_id and stock >= item_quantity;
      if not found then
        raise exception 'Inventory item is unavailable or stock is insufficient';
      end if;
    end if;

    insert into public.sales_transaction_items (transaction_id, inventory_item_id, name, quantity, unit_price)
    values (created_transaction.id, inventory_id, item_name, item_quantity, item_price);
  end loop;

  insert into public.payments (transaction_id, amount, method, received_by)
  values (created_transaction.id, p_received_amount, p_payment_method, p_created_by);

  return created_transaction;
end;
$$;

create or replace function public.void_transaction(
  p_transaction_id uuid,
  p_voided_by uuid
)
returns public.sales_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_transaction public.sales_transactions;
  item record;
begin
  select * into existing_transaction
  from public.sales_transactions
  where id = p_transaction_id
  for update;

  if existing_transaction.id is null or existing_transaction.status <> 'completed' then
    raise exception 'Transaction is not available for voiding';
  end if;

  for item in
    select inventory_item_id, quantity
    from public.sales_transaction_items
    where transaction_id = p_transaction_id and inventory_item_id is not null
  loop
    update public.inventory_items
    set stock = stock + item.quantity
    where id = item.inventory_item_id;
  end loop;

  update public.sales_transactions
  set status = 'voided', voided_at = now(), voided_by = p_voided_by
  where id = p_transaction_id
  returning * into existing_transaction;

  update public.payments
  set status = 'voided', voided_at = now()
  where transaction_id = p_transaction_id and status = 'captured';

  return existing_transaction;
end;
$$;

revoke all on function public.create_transaction_with_payment(numeric, numeric, numeric, numeric, text, numeric, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.void_transaction(uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_transaction_with_payment(numeric, numeric, numeric, numeric, text, numeric, uuid, jsonb) to service_role;
grant execute on function public.void_transaction(uuid, uuid) to service_role;