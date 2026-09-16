-- Optimistic concurrency for order edits.
--
-- Two staff with the same order open could save over each other: the second save
-- silently replaced the first, and the loser's work disappeared with no warning.
-- The editor now sends the `updated_at` it loaded, and the write is refused if the
-- row has moved on since — so the second save fails loudly instead of quietly.
--
-- `p_expected_updated_at` defaults to null, which skips the check, so a backend
-- still running the previous version keeps working through a rolling deploy. The
-- API layer always sends it.
--
-- The 10-argument signature has to be dropped rather than replaced: adding a
-- parameter with a default would otherwise leave both overloads in place and make
-- a 10-argument call ambiguous.

drop function if exists public.replace_order_with_items(uuid, text, text, numeric, text, boolean, jsonb, uuid, uuid, date);

create or replace function public.replace_order_with_items(
  p_order_id uuid,
  p_customer text,
  p_status text,
  p_amount numeric,
  p_notes text,
  p_is_custom boolean,
  p_items jsonb,
  p_actor_id uuid,
  p_customer_id uuid default null,
  p_due_date date default null,
  p_expected_updated_at timestamptz default null
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

  -- Checked *after* the row lock, so a save that arrives while another is still in
  -- flight waits for it and then sees the committed version rather than racing
  -- past it. `updated_at` is maintained by the orders_set_updated_at trigger, so
  -- it advances on every successful write.
  if p_expected_updated_at is not null and existing_order.updated_at <> p_expected_updated_at then
    raise exception 'This order was changed by someone else while you were editing it.'
      using detail = json_build_object(
        'orderId', p_order_id,
        'expectedUpdatedAt', p_expected_updated_at,
        'currentUpdatedAt', existing_order.updated_at
      )::text;
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
      is_custom = coalesce(p_is_custom, false),
      customer_id = coalesce(p_customer_id, customer_id),
      due_date = coalesce(p_due_date, due_date)
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

revoke all on function public.replace_order_with_items(uuid, text, text, numeric, text, boolean, jsonb, uuid, uuid, date, timestamptz) from public, anon, authenticated;
grant execute on function public.replace_order_with_items(uuid, text, text, numeric, text, boolean, jsonb, uuid, uuid, date, timestamptz) to service_role;
