-- 3.7 (R15) — `purchase_orders` has no API surface at all: no router, no service,
-- no UI read or write. The only thing that ever touched it was the demo seeder,
-- which now skips it (see backend/src/scripts/seedDemoData.ts).
--
-- Rather than drop the table (which would destroy a schema that may well back a
-- real purchase-order feature for a print shop buying paper/ink from suppliers),
-- we mark it reserved. The table stays, the FK index added in 20260921000700 stays
-- valid, and the intent is recorded here so nobody mistakes it for live data.
--
-- If purchase-order tracking is built, delete this comment and wire it up.
-- If it will never be built, drop the table in a later migration.

comment on table public.purchase_orders is
  'RESERVED — not wired to any API or UI. Seeded only for demo shape until 2026-09-21, now skipped by the seeder. Back a real purchase-order feature here, or drop the table in a later migration if it will not be built.';
