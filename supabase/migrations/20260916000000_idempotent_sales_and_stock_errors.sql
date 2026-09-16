-- Tier 3 — money safety at checkout, and a failure message a cashier can act on.
--
-- Two changes, both to the same function:
--
--   1. `idempotency_key` on `sales_transactions`. A double-click on "Confirm &
--      Pay", or a retry after a response was lost in transit, currently creates a
--      second sale and takes the customer's money twice. With a key, a replay
--      returns the original transaction instead.
--
--   2. `create_transaction_with_payment` now says WHICH item ran out and how many
--      were left, instead of "Inventory item is unavailable or stock is
--      insufficient". The database has always known this; the message was just
--      discarding it, leaving the cashier unable to tell the customer anything.
--
-- The function is REPLACED, never edited in place — an applied migration is
-- immutable. Note that the argument list changes, so the old 8-argument function
-- must be dropped explicitly: `create or replace` with a different signature
-- would leave the old one behind as a second overload.

-- ─── 1. Idempotency key ──────────────────────────────────────────────────────

alter table public.sales_transactions
  add column if not exists idempotency_key text;

comment on column public.sales_transactions.idempotency_key is
  'Identifies one checkout attempt. A replay carrying the same key returns the '
  'original transaction instead of creating a second sale. NULL for rows written '
  'before this column existed, and for clients that do not supply a key.';

-- Partial index: it must be unique only among the rows that actually carry a key.
-- A plain unique index would also be fine here (NULLs never conflict), but being
-- explicit documents the intent and keeps the index small.
create unique index if not exists sales_transactions_idempotency_key_key
  on public.sales_transactions (idempotency_key)
  where idempotency_key is not null;

-- ─── 2. The RPC ──────────────────────────────────────────────────────────────

drop function if exists public.create_transaction_with_payment(
  numeric, numeric, numeric, numeric, text, numeric, uuid, jsonb
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
  -- Defaulted so that a backend still running the previous version keeps working
  -- through the deploy window. The API now requires it.
  p_idempotency_key text default null
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

  return created_transaction;
end;
$$;

-- A new function is executable by PUBLIC by default, so the grants must be
-- restated for the new signature.
revoke all on function public.create_transaction_with_payment(
  numeric, numeric, numeric, numeric, text, numeric, uuid, jsonb, text
) from public, anon, authenticated;

grant execute on function public.create_transaction_with_payment(
  numeric, numeric, numeric, numeric, text, numeric, uuid, jsonb, text
) to service_role;
