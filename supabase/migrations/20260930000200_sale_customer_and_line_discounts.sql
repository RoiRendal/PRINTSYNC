-- Retail sales can name a customer; lines can carry a discount; and the till's
-- price is the price.
--
-- Three changes to the money path, in one migration because they touch the same
-- three functions and splitting them would mean writing each body twice.
--
-- ═══ 1. Why the sale RPC no longer re-prices from the catalogue ═══════════════
--
-- `create_transaction_with_payment` used to overwrite each line's `unitPrice`
-- with the catalogue price and then reject any request whose subtotal disagreed:
--
--     select price into item_price from public.inventory_items where id = inventory_id;
--     calculated_subtotal := calculated_subtotal + (item_quantity * item_price);
--     if round(calculated_subtotal, 2) <> round(p_subtotal, 2) then raise ...
--
-- Two things were wrong with that. The till can override a line's rate — that is
-- what the POS "Rate" field is for — and the check rejected every such sale with
-- `Transaction totals do not match the items`, an error the cashier cannot act
-- on. And the insert loop re-read the price a second time, so even a sale that
-- passed would have recorded the catalogue price rather than the one agreed with
-- the customer. Measured against the live stack before this change: an overridden
-- rate → 400; the same payload at the catalogue rate → reached the stock check.
--
-- The order RPC has always trusted the client's `unitPrice`, so the two halves of
-- the same till disagreed about who owns pricing. They now agree: the caller sets
-- the price, the server validates its *shape* (non-negative, discount within the
-- line) rather than its value. The sale is still an authenticated, permissioned
-- call, and `p_received_amount = p_total` is still enforced, so the money that
-- changes hands is still checked against the money that was rung up.
--
-- ═══ 2. Per-line discounts ════════════════════════════════════════════════════
--
-- Stored per line on both item tables. The discount MODEL is unchanged, which is
-- what keeps this backwards compatible:
--
--   * `subtotal` remains the gross sum, Σ(unit_price × quantity).
--   * `discount` is the grand total discount and now INCLUDES the line discounts.
--     A caller that sends no line discounts therefore sends exactly what it sent
--     before, and `total = subtotal - discount + tax` is the same formula.
--   * The new invariant is one-directional: the grand discount must be at least
--     the sum of the line discounts. A caller cannot claim line discounts it has
--     not subtracted from the total.
--
-- ═══ 3. Customer on a retail sale ═════════════════════════════════════════════
--
-- `sales_transactions` had no customer column, so a walk-in could not be attached
-- to a sale even though the till can name one. Both columns are nullable-in-
-- effect (`customer` defaults to `''`) because a retail sale is legitimately
-- anonymous — unlike a custom order, where the RPC requires a name.

-- ─── Columns ─────────────────────────────────────────────────────────────────

alter table public.sales_transactions
  add column customer text not null default '',
  add column customer_id uuid references public.customers(id) on delete set null;

-- Named, and it has to exist: an unindexed foreign key makes every customer
-- delete scan the whole sales table.
create index if not exists sales_transactions_customer_id_idx
  on public.sales_transactions(customer_id);

alter table public.order_items
  add column line_discount numeric(12, 2) not null default 0
  constraint order_items_line_discount_non_negative check (line_discount >= 0);

alter table public.sales_transaction_items
  add column line_discount numeric(12, 2) not null default 0
  constraint sales_transaction_items_line_discount_non_negative check (line_discount >= 0);

comment on column public.sales_transactions.customer is
  'Free-text customer name. Empty for an anonymous walk-in sale.';
comment on column public.order_items.line_discount is
  'Discount applied to this line alone, in currency. Included in orders.amount via the caller''s total.';
comment on column public.sales_transaction_items.line_discount is
  'Discount applied to this line alone, in currency. Included in sales_transactions.discount.';

-- ─── create_order_with_items — same signature, line discounts ────────────────
--
-- Parameter list is unchanged, so `create or replace` replaces in place and no
-- new overload appears. Body copied from 20260921000500_atomic_audit_writes.sql.

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
  item_line_discount numeric;
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
    item_line_discount := coalesce((item->>'lineDiscount')::numeric, 0);

    if item_quantity is null or item_quantity <= 0 or item_name = '' or item_price < 0 then
      raise exception 'Invalid order item';
    end if;

    -- A line cannot be discounted below zero, and the check is against the gross
    -- line value so a discount larger than the line is refused rather than
    -- quietly turning into a negative contribution.
    if item_line_discount < 0 or round(item_line_discount, 2) > round(item_quantity * item_price, 2) then
      raise exception 'Invalid order item discount';
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

    insert into public.order_items (order_id, inventory_item_id, design_id, name, quantity, unit_price, line_discount)
    values (created_order.id, inventory_id, nullif(item->>'designId', '')::uuid, item_name, item_quantity, item_price, item_line_discount);
  end loop;

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

-- ─── replace_order_with_items — same signature, line discounts ───────────────

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
      update public.inventory_items
      set stock = stock - item_quantity
      where id = inventory_id and stock >= item_quantity;
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

-- ─── create_transaction_with_payment — new arity, so drop the old one first ──
--
-- The customer parameters are appended AFTER the audit trio rather than slotted
-- in beside `p_created_by` where they read better, so that a positional call
-- written against the previous arity still binds its arguments to the same
-- parameters. Both callers use named arguments today; this is insurance for one
-- that does not.

drop function if exists public.create_transaction_with_payment(
  numeric, numeric, numeric, numeric, text, numeric, uuid, jsonb, text, text, inet, text
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
  p_customer_id uuid default null
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
    item_line_discount := coalesce((item->>'lineDiscount')::numeric, 0);

    if item_quantity is null or item_quantity <= 0 or item_name = '' or item_price < 0 then
      raise exception 'Invalid transaction item';
    end if;

    if item_line_discount < 0 or round(item_line_discount, 2) > round(item_quantity * item_price, 2) then
      raise exception 'Invalid transaction item discount';
    end if;

    -- The item must exist, but its catalogue price is NOT read: the caller's
    -- `unitPrice` stands. See the header note — this is the change that lets the
    -- till override a rate.
    if inventory_id is not null then
      perform 1 from public.inventory_items where id = inventory_id;
      if not found then
        raise exception 'Inventory item not found';
      end if;
    end if;

    calculated_subtotal := calculated_subtotal + (item_quantity * item_price);
    calculated_line_discounts := calculated_line_discounts + item_line_discount;
  end loop;

  -- `total = subtotal - discount + tax` is unchanged, so a caller that sends no
  -- line discounts validates exactly as it did before. What is new is the
  -- one-directional check: the grand discount has to be at least the line
  -- discounts, or the caller would be claiming a discount it never took off.
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
      subtotal, discount, tax, total, payment_method, created_by, idempotency_key, customer, customer_id
    )
    values (
      p_subtotal, p_discount, p_tax, p_total, p_payment_method, p_created_by, p_idempotency_key,
      btrim(coalesce(p_customer, '')), p_customer_id
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
      -- Lock the row, then compare, then deduct. `price` is deliberately NOT
      -- selected: the second read used to overwrite the caller's rate here too,
      -- which meant even a sale that passed validation stored the catalogue
      -- price instead of the one on the receipt.
      select name, stock
        into stock_item_name, item_stock
      from public.inventory_items
      where id = inventory_id
      for update;

      if not found then
        raise exception 'Inventory item not found';
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
    p_metadata => jsonb_build_object('total', created_transaction.total, 'paymentMethod', created_transaction.payment_method),
    p_ip_address => p_audit_ip_address,
    p_user_agent => p_audit_user_agent,
    p_request_id => p_audit_request_id
  );

  return created_transaction;
end;
$$;

-- A new function is executable by PUBLIC by default, so the grants are restated
-- for the new signature — and the three bodies above keep the arities they had,
-- so only this one needs restating.

revoke all on function public.create_transaction_with_payment(
  numeric, numeric, numeric, numeric, text, numeric, uuid, jsonb, text, text, inet, text, text, uuid
) from public, anon, authenticated;

grant execute on function public.create_transaction_with_payment(
  numeric, numeric, numeric, numeric, text, numeric, uuid, jsonb, text, text, inet, text, text, uuid
) to service_role;
