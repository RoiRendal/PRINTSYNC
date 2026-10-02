-- Give the money RPCs a branch, and a human document number.
--
-- Phase 2's first migration (20261002000300_branch_scoping.sql) added the
-- `branch_id` column to `orders` and `sales_transactions` and made it `not null`.
-- That means the next insert into either table **must** supply one — and the only
-- code that inserts them is the pair of RPCs recreated here. Without this
-- migration every order and every sale would start failing on a not-null
-- violation the moment the schema landed.
--
-- ## Why this is a second file rather than folded into the first
--
-- Supabase runs each file in one transaction, and a function that references
-- `branch_id` cannot be created in the same transaction that added the column in
-- some PostgreSQL versions' dependency ordering. Keeping the DDL (columns,
-- indexes, the counter table) separate from the code change (the RPC bodies)
-- means each is reviewable and reversible on its own, and the replay exercises
-- them in the order the platform would.
--
-- ## Branch numbering
--
-- Each order and each sale is allocated a reference (`BAL-0001`, `NAS-0001`) from
-- `next_document_number` (created in the previous migration), inside the same
-- transaction as the row insert. The number therefore cannot be lost if the
-- insert rolls back — it is allocated by the same statement that commits.
--
-- The counter is drawn *after* the row's other validation, so a rejected request
-- does not burn a number.
--
-- ## What did NOT change, and why that matters
--
-- The parameter lists have the SAME names and the SAME order as the versions in
-- 20260930000200_sale_customer_and_line_discounts.sql, with `p_branch_id`
-- appended. Appending rather than inserting keeps a positional caller working and
-- — critically — keeps `create or replace` honest: an appended parameter is still
-- a *changed signature*, so each function must be `drop`ped first or Postgres
-- leaves the old 14-argument version beside the new 15-argument one as a second
-- overload. That is the exact trap `20260921000100_drop_stale_order_rpc_overloads.sql`
-- was written to clean up, and the replay's overload check guards against it
-- recurring.

-- ─── create_order_with_items — + p_branch_id ────────────────────────────────

drop function if exists public.create_order_with_items(
  text, text, numeric, text, boolean, uuid, jsonb, uuid, date, text, inet, text
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
  p_audit_user_agent text default null,
  -- The branch that owns the order. Required by the caller (the API reads it
  -- from the authenticated profile); defaulted to null so a stale backend still
  -- running the previous arity fails loudly on the not-null constraint rather
  -- than silently filing the order under an arbitrary branch.
  p_branch_id uuid default null
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
  item_line_discount numeric;
begin
  if length(btrim(coalesce(p_customer, ''))) = 0 or p_amount < 0 or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Invalid order details';
  end if;

  if p_branch_id is null then
    raise exception 'A branch is required to create an order';
  end if;

  insert into public.orders (customer, status, amount, notes, is_custom, created_by, customer_id, due_date, branch_id, reference)
  values (
    btrim(p_customer), coalesce(p_status, 'Pending'), p_amount, coalesce(p_notes, ''),
    coalesce(p_is_custom, false), p_created_by, p_customer_id, p_due_date,
    p_branch_id,
    public.next_document_number(p_branch_id, 'order')
  )
  returning * into created_order;

  for item in select * from jsonb_array_elements(p_items)
  loop
    inventory_id := nullif(item->>'itemId', '')::uuid;
    item_quantity := (item->>'quantity')::integer;
    item_name := btrim(item->>'name');
    item_price := coalesce((item->>'unitPrice')::numeric, 0);
    item_line_discount := coalesce((item->>'lineDiscount')::numeric, 0);

    if item_quantity is null or item_quantity <= 0 or item_name = '' or item_price < 0 then
      raise exception 'Invalid order item';
    end if;

    if item_line_discount < 0 or round(item_line_discount, 2) > round(item_quantity * item_price, 2) then
      raise exception 'Invalid order item discount';
    end if;

    if inventory_id is not null then
      -- The stock decrement is scoped to the same branch. An order can only
      -- reserve stock from its own branch's shelf: a Balayan order referencing a
      -- Nasugbu item would otherwise deduct Nasugbu's count from Balayan's till.
      update public.inventory_items
      set stock = stock - item_quantity
      where id = inventory_id and branch_id = p_branch_id and stock >= item_quantity;
      if not found then
        raise exception 'Inventory item is unavailable or stock is insufficient';
      end if;

      insert into public.inventory_movements (inventory_item_id, quantity, reason, actor_id)
      values (inventory_id, -item_quantity, 'Order stock reservation', p_created_by);
    end if;

    insert into public.order_items (order_id, inventory_item_id, design_id, name, quantity, unit_price, line_discount)
    values (created_order.id, inventory_id, nullif(item->>'designId', '')::uuid, item_name, item_quantity, item_price, item_line_discount);
  end loop;

  perform public.write_audit_log(
    p_actor_id => p_created_by,
    p_action => 'order.created',
    p_entity_type => 'order',
    p_entity_id => created_order.id::text,
    p_metadata => jsonb_build_object('amount', created_order.amount, 'isCustom', created_order.is_custom, 'reference', created_order.reference),
    p_ip_address => p_audit_ip_address,
    p_user_agent => p_audit_user_agent,
    p_request_id => p_audit_request_id
  );

  return created_order;
end;
$$;

revoke all on function public.create_order_with_items(
  text, text, numeric, text, boolean, uuid, jsonb, uuid, date, text, inet, text, uuid
) from public, anon, authenticated;

grant execute on function public.create_order_with_items(
  text, text, numeric, text, boolean, uuid, jsonb, uuid, date, text, inet, text, uuid
) to service_role;

-- ─── replace_order_with_items — + p_branch_id ───────────────────────────────
--
-- Branch is NOT taken from the payload as an editable field: an order's branch is
-- fixed at creation and never moved (there is no inter-branch transfer). The
-- parameter exists only so the stock check below can be scoped to the order's own
-- branch; the update itself deliberately does not write `branch_id`.

drop function if exists public.replace_order_with_items(
  uuid, text, text, numeric, text, boolean, jsonb, uuid, uuid, date, timestamptz, text, inet, text
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
  p_audit_user_agent text default null,
  p_branch_id uuid default null
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
  item_line_discount numeric;
begin
  select * into existing_order
  from public.orders
  where id = p_order_id
  for update;

  if existing_order.id is null then
    raise exception 'Order not found';
  end if;

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

  -- Release the previously reserved stock back to the branch's own shelf.
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
    item_line_discount := coalesce((item->>'lineDiscount')::numeric, 0);

    if item_quantity is null or item_quantity <= 0 or item_name = '' or item_price < 0 then
      raise exception 'Invalid order item';
    end if;

    if item_line_discount < 0 or round(item_line_discount, 2) > round(item_quantity * item_price, 2) then
      raise exception 'Invalid order item discount';
    end if;

    if inventory_id is not null then
      -- `coalesce(p_branch_id, updated_order.branch_id)` so an older caller that
      -- does not send a branch still gets the correct scoping from the order
      -- itself. The order's branch is the authority; the parameter is an
      -- optimisation that lets the index be used directly.
      update public.inventory_items
      set stock = stock - item_quantity
      where id = inventory_id
        and branch_id = coalesce(p_branch_id, updated_order.branch_id)
        and stock >= item_quantity;
      if not found then
        raise exception 'Inventory item is unavailable or stock is insufficient';
      end if;

      insert into public.inventory_movements (inventory_item_id, quantity, reason, actor_id)
      values (inventory_id, -item_quantity, 'Order stock reservation for update', p_actor_id);
    end if;

    insert into public.order_items (order_id, inventory_item_id, design_id, name, quantity, unit_price, line_discount)
    values (p_order_id, inventory_id, nullif(item->>'designId', '')::uuid, item_name, item_quantity, item_price, item_line_discount);
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
  uuid, text, text, numeric, text, boolean, jsonb, uuid, uuid, date, timestamptz, text, inet, text, uuid
) from public, anon, authenticated;

grant execute on function public.replace_order_with_items(
  uuid, text, text, numeric, text, boolean, jsonb, uuid, uuid, date, timestamptz, text, inet, text, uuid
) to service_role;

-- ─── create_transaction_with_payment — + p_branch_id ────────────────────────
--
-- Body copied from 20260930000200_sale_customer_and_line_discounts.sql with three
-- changes, each called out in a comment below: the branch is written on the sale,
-- a reference is allocated, and the stock check is scoped to the branch. Every
-- other behavioural guarantee (replay guard, per-line discounts, the pricing
-- rules, the audit write, the unique-index reversal) is preserved exactly.

drop function if exists public.create_transaction_with_payment(
  numeric, numeric, numeric, numeric, text, numeric, uuid, jsonb, text, text, inet, text, text, uuid
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
  p_audit_user_agent text default null,
  p_customer text default null,
  p_customer_id uuid default null,
  p_branch_id uuid default null
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
  item_line_discount numeric;
  item_stock integer;
  stock_item_name text;
  calculated_subtotal numeric := 0;
  calculated_line_discounts numeric := 0;
begin
  -- ── Replay guard. MUST run before the branch is validated. ─────────────────
  -- A replay of a committed checkout must return the original sale unchanged, so
  -- it must not be blocked by anything — including a branch check that a retry
  -- from a differently-configured client might fail.
  if p_idempotency_key is not null then
    if length(btrim(p_idempotency_key)) not between 8 and 128 then
      raise exception 'Invalid idempotency key';
    end if;

    select * into existing_transaction
    from public.sales_transactions
    where idempotency_key = p_idempotency_key;

    if found then
      return existing_transaction;
    end if;
  end if;

  if p_discount < 0 or p_tax < 0 or p_payment_method not in ('Cash', 'Card', 'Custom Order')
    or p_received_amount <= 0 or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Invalid transaction details';
  end if;

  -- NEW: a sale without a branch is not a sale this system can file.
  if p_branch_id is null then
    raise exception 'A branch is required to record a sale';
  end if;

  for item in select * from jsonb_array_elements(p_items)
  loop
    inventory_id := nullif(item->>'itemId', '')::uuid;
    item_quantity := (item->>'quantity')::integer;
    item_name := btrim(item->>'name');
    item_price := coalesce((item->>'unitPrice')::numeric, 0);
    item_line_discount := coalesce((item->>'lineDiscount')::numeric, 0);

    if item_quantity is null or item_quantity <= 0 or item_name = '' or item_price < 0 then
      raise exception 'Invalid transaction item';
    end if;

    if item_line_discount < 0 or round(item_line_discount, 2) > round(item_quantity * item_price, 2) then
      raise exception 'Invalid transaction item discount';
    end if;

    if inventory_id is not null then
      perform 1 from public.inventory_items where id = inventory_id;
      if not found then
        raise exception 'Inventory item not found';
      end if;
    end if;

    calculated_subtotal := calculated_subtotal + (item_quantity * item_price);
    calculated_line_discounts := calculated_line_discounts + item_line_discount;
  end loop;

  if round(calculated_subtotal, 2) <> round(p_subtotal, 2)
    or round(calculated_line_discounts, 2) > round(p_discount, 2)
    or p_discount > p_subtotal
    or round(p_subtotal - p_discount + p_tax, 2) <> round(p_total, 2)
    or round(p_received_amount, 2) <> round(p_total, 2) then
    raise exception 'Transaction totals do not match the items';
  end if;

  -- ── Insert. The unique index is what actually makes this concurrency-safe. ──
  begin
    insert into public.sales_transactions (
      subtotal, discount, tax, total, payment_method, created_by, idempotency_key, customer, customer_id,
      branch_id, reference
    )
    values (
      p_subtotal, p_discount, p_tax, p_total, p_payment_method, p_created_by, p_idempotency_key,
      btrim(coalesce(p_customer, '')), p_customer_id,
      p_branch_id,
      public.next_document_number(p_branch_id, 'sale')
    )
    returning * into created_transaction;
  exception when unique_violation then
    select * into existing_transaction
    from public.sales_transactions
    where idempotency_key = p_idempotency_key;

    if not found then
      raise;
    end if;

    return existing_transaction;
  end;

  for item in select * from jsonb_array_elements(p_items)
  loop
    inventory_id := nullif(item->>'itemId', '')::uuid;
    item_quantity := (item->>'quantity')::integer;
    item_name := btrim(item->>'name');
    item_price := coalesce((item->>'unitPrice')::numeric, 0);
    item_line_discount := coalesce((item->>'lineDiscount')::numeric, 0);

    if inventory_id is not null then
      -- NEW: the row lock and the stock comparison are on the branch's own item.
      -- The predicate includes `branch_id = p_branch_id`, so a Nasugbu till
      -- cannot sell down a Balayan shelf even if it is handed a Balayan item id.
      select name, stock
        into stock_item_name, item_stock
      from public.inventory_items
      where id = inventory_id and branch_id = p_branch_id
      for update;

      if not found then
        raise exception 'Inventory item not found for this branch';
      end if;

      if item_stock < item_quantity then
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

    insert into public.sales_transaction_items (transaction_id, inventory_item_id, name, quantity, unit_price, line_discount)
    values (created_transaction.id, inventory_id, item_name, item_quantity, item_price, item_line_discount);
  end loop;

  insert into public.payments (transaction_id, amount, method, received_by)
  values (created_transaction.id, p_received_amount, p_payment_method, p_created_by);

  perform public.write_audit_log(
    p_actor_id => p_created_by,
    p_action => 'transaction.created',
    p_entity_type => 'sales_transaction',
    p_entity_id => created_transaction.id::text,
    p_metadata => jsonb_build_object('total', created_transaction.total, 'paymentMethod', created_transaction.payment_method, 'reference', created_transaction.reference),
    p_ip_address => p_audit_ip_address,
    p_user_agent => p_audit_user_agent,
    p_request_id => p_audit_request_id
  );

  return created_transaction;
end;
$$;

revoke all on function public.create_transaction_with_payment(
  numeric, numeric, numeric, numeric, text, numeric, uuid, jsonb, text, text, inet, text, text, uuid, uuid
) from public, anon, authenticated;

grant execute on function public.create_transaction_with_payment(
  numeric, numeric, numeric, numeric, text, numeric, uuid, jsonb, text, text, inet, text, text, uuid, uuid
) to service_role;
