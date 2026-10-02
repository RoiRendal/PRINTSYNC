-- A printed receipt must say which shop it came from.
--
-- ## The defect this closes
--
-- `PrintableDocumentView` heads every slip with the business name taken from
-- `GET /branding`. That endpoint is deliberately unauthenticated — the login screen
-- renders the name and logo before anyone has a session — so it can only ever serve
-- the business-wide row, which is Balayan's. A receipt printed at Nasugbu therefore
-- came out headed with Balayan's name.
--
-- The name is fixable in the API (an authenticated caller can be told its own
-- branch's branding). The *address* is not: `business_settings` had no address
-- column at all, and `branches.address` has existed since Phase 1 and is rendered
-- nowhere. So there was nowhere to put a branch-specific address even if we wanted
-- to print one.
--
-- ## Why the address goes on `business_settings` and not read from `branches`
--
-- They are different facts that happen to look alike. `branches.address` is
-- administrative — where the branch is, used for a branch list. The receipt header
-- is a *trading* identity: the shop's own printed name and address, which a business
-- may well want to write differently from its internal registry entry ("IC Printing
-- Services — Balayan" with a landmark line, say). It also already sits on the row
-- the print path reads and that is already per-branch, so no join is introduced into
-- a query that runs on every slip.
--
-- Defaulting to the empty string rather than backfilling from `branches.address` is
-- deliberate: an empty value prints no line at all, whereas a guessed value prints
-- something wrong on a customer's receipt. Wrong paperwork is worse than sparse
-- paperwork. Balayan's real address is filled in by the seed data; Nasugbu's is
-- filled in by whatever the shop tells us.

alter table public.business_settings
  add column if not exists address text not null default '';

comment on column public.business_settings.address is
  'The branch''s printed address, shown on receipts and job tickets. Empty means the receipt omits the line. Distinct from branches.address, which is the administrative location.';

-- The address is part of the settings a manager edits, so it travels with the rest.
-- No new grant: columns added to a table are covered by its existing table-level
-- grants, and `business_settings` already grants select/insert/update/delete to
-- service_role.
