-- A money action and its audit row now commit or roll back together.
--
-- ## The gap
--
-- Every money route did this:
--
--   1. call the RPC, which commits — the sale is taken, the stock is deducted,
--      the order is deleted;
--   2. then call `write_audit_log` as a *second* statement.
--
-- If step 2 failed, step 1 stood. The audit log is the only record that a hard
-- delete happened — there is no soft delete anywhere in this schema — so a lost
-- audit row can mean an unrecoverable, unrecorded deletion. A warning in the
-- server log was the only trace that the record was missing.
--
-- ## The fix
--
-- Each money RPC now writes its own audit row before it returns, inside its own
-- transaction. A failure to record the action now aborts the action, which is the
-- correct direction: the shop would rather be told "the sale did not go through"
-- than discover months later that an order was deleted and nothing says by whom.
--
-- ## The audit context
--
-- Three trailing parameters carry what the row needs beyond the operation itself:
-- the request id, the client address and the user agent. They are trailing and
-- defaulted for the same reason as everywhere else in this set — a backend still
-- running the previous version sends the old argument count, and that call has to
-- resolve to this function rather than fail. The old signature is dropped first,
-- because `create or replace` with a different argument list would leave the old
-- one behind as a second overload.
--
-- `p_audit_ip_address` is `inet`, and the API validates the address with
-- `net.isIP` before sending it. That matters here in a way it did not before: an
-- uncastable value would now raise *inside* the money transaction and roll back a
-- sale. A missing address in an audit row is a small loss; a failed checkout is
-- not, so the value is checked at the boundary rather than trusted.
--
-- ## What this does not cover
--
-- The five functions below are the money *RPCs*. Hard deletes that have no RPC —
-- customers, suppliers, designs, expenses, inventory items — and the two
-- `order_payments` writes still audit from the route, after the fact. Closing
-- those means giving each one an RPC of its own, which is a larger change than
-- this one and is not attempted here.

-- ─── create_order_with_items ─────────────────────────────────────────────────

drop function if exists public.create_order_with_items(
  text, text, numeric, text, boolean, uuid, jsonb, uuid, date
);

create or replace function public.create_order_with_items(
  p_customer text,
  p_status text,
  p_amount numeric,
  p_notes text,
  p_is_custom boolean,
  p_created_by uuid,
  p_items jsonb,
  p_customer_id uuid default null,
  p_due_date date default null,
  p_audit_request_id text default null,
  p_audit_ip_address inet default null,
  p_audit_user_agent text default null
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

  insert into public.orders (customer, status, amount, notes, is_custom, created_by, customer_id, due_date)
  values (btrim(p_customer), coalesce(p_status, 'Pending'), p_amount, coalesce(p_notes, ''), coalesce(p_is_custom, false), p_created_by, p_customer_id, p_due_date)
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

  -- Inside the transaction. If this raises, the order and its stock reservation
  -- go with it.
  perform public.write_audit_log(
    p_actor_id => p_created_by,
    p_action => 'order.created',
    p_entity_type => 'order',
    p_entity_id => created_order.id::text,
    p_metadata => jsonb_build_object('amount', created_order.amount, 'isCustom', created_order.is_custom),
    p_ip_address => p_audit_ip_address,
    p_user_agent => p_audit_user_agent,
    p_request_id => p_audit_request_id
  );

  return created_order;
end;
$$;

revoke all on function public.create_order_with_items(
  text, text, numeric, text, boolean, uuid, jsonb, uuid, date, text, inet, text
) from public, anon, authenticated;

grant execute on function public.create_order_with_items(
  text, text, numeric, text, boolean, uuid, jsonb, uuid, date, text, inet, text
) to service_role;

-- ─── replace_order_with_items ────────────────────────────────────────────────

drop function if exists public.replace_order_with_items(
  uuid, text, text, numeric, text, boolean, jsonb, uuid, uuid, date, timestamptz
);

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
  p_expected_updated_at timestamptz default null,
  p_audit_request_id text default null,
  p_audit_ip_address inet default null,
  p_audit_user_agent text default null
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

  perform public.write_audit_log(
    p_actor_id => p_actor_id,
    p_action => 'order.updated',
    p_entity_type => 'order',
    p_entity_id => updated_order.id::text,
    p_metadata => jsonb_build_object('status', updated_order.status),
    p_ip_address => p_audit_ip_address,
    p_user_agent => p_audit_user_agent,
    p_request_id => p_audit_request_id
  );

  return updated_order;
end;
$$;

revoke all on function public.replace_order_with_items(
  uuid, text, text, numeric, text, boolean, jsonb, uuid, uuid, date, timestamptz, text, inet, text
) from public, anon, authenticated;

grant execute on function public.replace_order_with_items(
  uuid, text, text, numeric, text, boolean, jsonb, uuid, uuid, date, timestamptz, text, inet, text
) to service_role;

-- ─── delete_order_with_items ─────────────────────────────────────────────────
--
-- The one this whole migration matters most for. The order row is gone after
-- this returns; the audit row is the only remaining evidence that it existed.

drop function if exists public.delete_order_with_items(uuid, uuid);

create or replace function public.delete_order_with_items(
  p_order_id uuid,
  p_actor_id uuid,
  p_audit_request_id text default null,
  p_audit_ip_address inet default null,
  p_audit_user_agent text default null
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

  -- `entity_id` is text with no foreign key, so it survives the row it names.
  perform public.write_audit_log(
    p_actor_id => p_actor_id,
    p_action => 'order.deleted',
    p_entity_type => 'order',
    p_entity_id => p_order_id::text,
    p_metadata => '{}'::jsonb,
    p_ip_address => p_audit_ip_address,
    p_user_agent => p_audit_user_agent,
    p_request_id => p_audit_request_id
  );
end;
$$;

revoke all on function public.delete_order_with_items(uuid, uuid, text, inet, text)
  from public, anon, authenticated;

grant execute on function public.delete_order_with_items(uuid, uuid, text, inet, text)
  to service_role;

-- ─── create_transaction_with_payment ─────────────────────────────────────────

drop function if exists public.create_transaction_with_payment(
  numeric, numeric, numeric, numeric, text, numeric, uuid, jsonb, text
);

create or replace function public.create_transaction_with_payment(
  p_subtotal numeric,
  p_discount numeric,
  p_tax numeric,
  p_total numeric,
  p_payment_method text,
  p_received_amount numeric,
  p_created_by uuid,
  p_items jsonb,
  p_idempotency_key text default null,
  p_audit_request_id text default null,
  p_audit_ip_address inet default null,
  p_audit_user_agent text default null
)
returns public.sales_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  created_transaction public.sales_transactions;
  existing_transaction public.sales_transactions;
  item jsonb;
  inventory_id uuid;
  item_quantity integer;
  item_name text;
  item_price numeric;
  item_stock integer;
  stock_item_name text;
  calculated_subtotal numeric := 0;
begin
  -- ── Replay guard. This MUST run before anything else. ──────────────────────
  -- The stock for a committed attempt has already been deducted, so re-running
  -- the validation below on a retry could reject the very request this exists to
  -- make safe (the item may now be at zero because of the original sale).
  if p_idempotency_key is not null then
    if length(btrim(p_idempotency_key)) not between 8 and 128 then
      raise exception 'Invalid idempotency key';
    end if;

    select * into existing_transaction
    from public.sales_transactions
    where idempotency_key = p_idempotency_key;

    if found then
      -- No audit row. A replay is not a money action: nothing was taken, and the
      -- attempt that did take it already has a row. Recording one here would make
      -- the audit log say a sale happened twice.
      return existing_transaction;
    end if;
  end if;

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

  -- ── Insert. The unique index is what actually makes this concurrency-safe. ──
  -- Two requests racing the same key both pass the SELECT above; the loser lands
  -- here, trips the index, and is caught. Without this, the guard would be a
  -- check-then-act race.
  begin
    insert into public.sales_transactions (
      subtotal, discount, tax, total, payment_method, created_by, idempotency_key
    )
    values (
      p_subtotal, p_discount, p_tax, p_total, p_payment_method, p_created_by, p_idempotency_key
    )
    returning * into created_transaction;
  exception when unique_violation then
    select * into existing_transaction
    from public.sales_transactions
    where idempotency_key = p_idempotency_key;

    if not found then
      -- Not our constraint. Re-raise rather than silently swallowing it.
      raise;
    end if;

    -- The concurrent replay. As above: no audit row.
    return existing_transaction;
  end;

  for item in select * from jsonb_array_elements(p_items)
  loop
    inventory_id := nullif(item->>'itemId', '')::uuid;
    item_quantity := (item->>'quantity')::integer;
    item_name := btrim(item->>'name');
    item_price := coalesce((item->>'unitPrice')::numeric, 0);

    if inventory_id is not null then
      -- Lock the row, then compare, then deduct. The previous version folded the
      -- check into the UPDATE's WHERE clause, which is correct for safety but
      -- throws away the numbers needed to explain the failure. `for update` keeps
      -- the same protection against two cashiers selling the last unit.
      select name, stock, price
        into stock_item_name, item_stock, item_price
      from public.inventory_items
      where id = inventory_id
      for update;

      if not found then
        raise exception 'Inventory item not found';
      end if;

      if item_stock < item_quantity then
        -- `detail` carries the same facts in a machine-readable form so the POS
        -- can point at the offending cart line rather than showing a banner.
        raise exception 'Only % left in stock for "%" (% requested).',
          item_stock, stock_item_name, item_quantity
          using detail = json_build_object(
            'itemId', inventory_id,
            'itemName', stock_item_name,
            'available', item_stock,
            'requested', item_quantity
          )::text;
      end if;

      update public.inventory_items
      set stock = stock - item_quantity
      where id = inventory_id;

      insert into public.inventory_movements (inventory_item_id, quantity, reason, actor_id)
      values (inventory_id, -item_quantity, 'Transaction stock deduction', p_created_by);
    end if;

    insert into public.sales_transaction_items (transaction_id, inventory_item_id, name, quantity, unit_price)
    values (created_transaction.id, inventory_id, item_name, item_quantity, item_price);
  end loop;

  insert into public.payments (transaction_id, amount, method, received_by)
  values (created_transaction.id, p_received_amount, p_payment_method, p_created_by);

  perform public.write_audit_log(
    p_actor_id => p_created_by,
    p_action => 'transaction.created',
    p_entity_type => 'sales_transaction',
    p_entity_id => created_transaction.id::text,
    p_metadata => jsonb_build_object('total', created_transaction.total, 'paymentMethod', created_transaction.payment_method),
    p_ip_address => p_audit_ip_address,
    p_user_agent => p_audit_user_agent,
    p_request_id => p_audit_request_id
  );

  return created_transaction;
end;
$$;

revoke all on function public.create_transaction_with_payment(
  numeric, numeric, numeric, numeric, text, numeric, uuid, jsonb, text, text, inet, text
) from public, anon, authenticated;

grant execute on function public.create_transaction_with_payment(
  numeric, numeric, numeric, numeric, text, numeric, uuid, jsonb, text, text, inet, text
) to service_role;

-- ─── void_transaction ────────────────────────────────────────────────────────

drop function if exists public.void_transaction(uuid, uuid);

create or replace function public.void_transaction(
  p_transaction_id uuid,
  p_voided_by uuid,
  p_audit_request_id text default null,
  p_audit_ip_address inet default null,
  p_audit_user_agent text default null
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

  perform public.write_audit_log(
    p_actor_id => p_voided_by,
    p_action => 'transaction.voided',
    p_entity_type => 'sales_transaction',
    p_entity_id => existing_transaction.id::text,
    p_metadata => '{}'::jsonb,
    p_ip_address => p_audit_ip_address,
    p_user_agent => p_audit_user_agent,
    p_request_id => p_audit_request_id
  );

  return existing_transaction;
end;
$$;

revoke all on function public.void_transaction(uuid, uuid, text, inet, text)
  from public, anon, authenticated;

grant execute on function public.void_transaction(uuid, uuid, text, inet, text)
  to service_role;
