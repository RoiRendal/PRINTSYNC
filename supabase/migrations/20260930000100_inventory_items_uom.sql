-- Unit of measure, so the till can print a price with its unit.
--
-- The POS price line wants ERPNext's `250.00 / Nos` shape, and the tile wants the
-- same. There was no unit anywhere in the schema — not on `inventory_items`, not
-- on `order_items`, not on `sales_transaction_items` — so the price line could
-- only ever be a bare figure. This is the missing column.
--
-- Deliberately on the ITEM, not on the line. A unit is a property of the product
-- (a ream of paper is sold by the ream), not of one sale, and copying it onto
-- every line would let the two drift. The lines keep only the numbers.
--
-- Additive and defaulted:
--
--   * `not null default 'pc'` means every existing row gets a real value in the
--     same statement — no backfill, no window where the column reads null, and
--     no nullable column for every reader to defend against.
--   * `'pc'` (piece) is the honest default for a print shop: it is what the
--     seeded catalogue means by a bare quantity, and it is what a row created by
--     an older backend — which cannot send a unit — should get.
--   * The check rejects a blank unit. An empty string is not "unknown", it is a
--     label that renders as `250.00 / ` with a trailing slash.

alter table public.inventory_items
  add column uom text not null default 'pc'
  constraint inventory_items_uom_not_blank check (length(btrim(uom)) > 0);

comment on column public.inventory_items.uom is
  'Unit of measure shown beside a price (e.g. pc, ream, sheet, box). Defaults to pc.';
