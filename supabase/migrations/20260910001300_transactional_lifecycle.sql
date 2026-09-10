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
  values (btrim(p_customer), coalesce(p_status, 'Pending'), p_amount, coalesce(p_notes, ''), coalesce(p_is_custom, false), p_created_by)
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

      insert into public.inventory_movements (inventory_item_id, quantity, reason, actor_id)
      values (inventory_id, -item_quantity, 'Order stock reservation', p_created_by);
    end if;

    insert into public.order_items (order_id, inventory_item_id, design_id, name, quantity, unit_price)
    values (created_order.id, inventory_id, nullif(item->>'designId', '')::uuid, item_name, item_quantity, item_price);
  end loop;

  return created_order;
end;
$$;

create or replace function public.replace_order_with_items(
  p_order_id uuid,
  p_customer text,
  p_status text,
  p_amount numeric,
  p_notes text,
  p_is_custom boolean,
  p_items jsonb,
  p_actor_id uuid
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_order public.orders;
  updated_order public.orders;
  item jsonb;
  existing_item record;
  inventory_id uuid;
  item_quantity integer;
  item_name text;
  item_price numeric;
begin
  select * into existing_order
  from public.orders
  where id = p_order_id
  for update;

  if existing_order.id is null then
    raise exception 'Order not found';
  end if;
  if length(btrim(coalesce(p_customer, ''))) = 0 or p_amount < 0 or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Invalid order details';
  end if;

  for existing_item in
    select inventory_item_id, quantity
    from public.order_items
    where order_id = p_order_id and inventory_item_id is not null
  loop
    update public.inventory_items
    set stock = stock + existing_item.quantity
    where id = existing_item.inventory_item_id;

    insert into public.inventory_movements (inventory_item_id, quantity, reason, actor_id)
    values (existing_item.inventory_item_id, existing_item.quantity, 'Order stock release for update', p_actor_id);
  end loop;

  delete from public.order_items where order_id = p_order_id;
  update public.orders
  set customer = btrim(p_customer),
      status = p_status,
      amount = p_amount,
      notes = coalesce(p_notes, ''),
      is_custom = coalesce(p_is_custom, false)
  where id = p_order_id
  returning * into updated_order;

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

      insert into public.inventory_movements (inventory_item_id, quantity, reason, actor_id)
      values (inventory_id, -item_quantity, 'Order stock reservation for update', p_actor_id);
    end if;

    insert into public.order_items (order_id, inventory_item_id, design_id, name, quantity, unit_price)
    values (p_order_id, inventory_id, nullif(item->>'designId', '')::uuid, item_name, item_quantity, item_price);
  end loop;

  return updated_order;
end;
$$;

create or replace function public.delete_order_with_items(
  p_order_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_order public.orders;
  existing_item record;
begin
  select * into existing_order
  from public.orders
  where id = p_order_id
  for update;

  if existing_order.id is null then
    raise exception 'Order not found';
  end if;

  for existing_item in
    select inventory_item_id, quantity
    from public.order_items
    where order_id = p_order_id and inventory_item_id is not null
  loop
    update public.inventory_items
    set stock = stock + existing_item.quantity
    where id = existing_item.inventory_item_id;

    insert into public.inventory_movements (inventory_item_id, quantity, reason, actor_id)
    values (existing_item.inventory_item_id, existing_item.quantity, 'Order stock release for deletion', p_actor_id);
  end loop;

  delete from public.orders where id = p_order_id;
end;
$$;

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
  calculated_subtotal numeric := 0;
begin
  if p_discount < 0 or p_tax < 0 or p_payment_method not in ('Cash', 'Card', 'Custom Order')
    or p_received_amount <= 0 or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Invalid transaction details';
  end if;

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
      select price into item_price
      from public.inventory_items
      where id = inventory_id;
      if not found then
        raise exception 'Inventory item not found';
      end if;
    end if;

    calculated_subtotal := calculated_subtotal + (item_quantity * item_price);
  end loop;

  if round(calculated_subtotal, 2) <> round(p_subtotal, 2)
    or p_discount > p_subtotal
    or round(p_subtotal - p_discount + p_tax, 2) <> round(p_total, 2)
    or round(p_received_amount, 2) <> round(p_total, 2) then
    raise exception 'Transaction totals do not match the items';
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

    if inventory_id is not null then
      select price into item_price from public.inventory_items where id = inventory_id;
      update public.inventory_items
      set stock = stock - item_quantity
      where id = inventory_id and stock >= item_quantity;
      if not found then
        raise exception 'Inventory item is unavailable or stock is insufficient';
      end if;

      insert into public.inventory_movements (inventory_item_id, quantity, reason, actor_id)
      values (inventory_id, -item_quantity, 'Transaction stock deduction', p_created_by);
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

    insert into public.inventory_movements (inventory_item_id, quantity, reason, actor_id)
    values (item.inventory_item_id, item.quantity, 'Transaction stock restoration for void', p_voided_by);
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

revoke all on function public.replace_order_with_items(uuid, text, text, numeric, text, boolean, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.delete_order_with_items(uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_order_with_items(text, text, numeric, text, boolean, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.create_transaction_with_payment(numeric, numeric, numeric, numeric, text, numeric, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.void_transaction(uuid, uuid) from public, anon, authenticated;
grant execute on function public.replace_order_with_items(uuid, text, text, numeric, text, boolean, jsonb, uuid) to service_role;
grant execute on function public.delete_order_with_items(uuid, uuid) to service_role;
grant execute on function public.create_order_with_items(text, text, numeric, text, boolean, uuid, jsonb) to service_role;
grant execute on function public.create_transaction_with_payment(numeric, numeric, numeric, numeric, text, numeric, uuid, jsonb) to service_role;
grant execute on function public.void_transaction(uuid, uuid) to service_role;