-- Branches: make PrintSync able to serve Balayan and Nasugbu as separate sites.
--
-- This is Phase 1 of the two-branch rollout. It introduces the branch concept and
-- makes per-branch settings possible; it does NOT yet tag operational data
-- (orders, stock, customers) — that is Phase 2, and it does NOT yet enforce the
-- boundary — that is Phase 3. Nothing here changes what a staff member sees.
--
-- Plan of record: 0_never-push-this-dump-folder/printsync-two-branch-plan.md
--
-- ## The three things this migration does
--
--   1. Creates `public.branches` and seeds Balayan (BAL) and Nasugbu (NAS).
--   2. Breaks the `business_settings` singleton so each branch owns its own
--      name, logo, VAT rate, currency and time zone. Until now `id = 1` was
--      enforced by a CHECK constraint, so the whole business shared one row.
--   3. Adds `profiles.branch_id` (membership) and
--      `profiles.can_view_all_branches` (the head-office analytics exception).
--
-- ## Why `can_view_all_branches` is a column and not a comparison against the
-- ## role name
--
-- The owner's rule is "every account belongs to exactly one branch, except the
-- owner/head office, who may look up analytics from another branch". A literal
-- `if (role === 'admin')` would make every future admin a cross-branch reader by
-- accident, and would be invisible in the data. A boolean column is explicit,
-- queryable, and auditable — and it means the *behaviour* can change without
-- changing an enum that other code reasons about.
--
-- ## Why `id integer` was kept rather than converted to uuid
--
-- `business_settings.id` is an `integer primary key default 1`. Converting the
-- type would require rewriting the table and every row in it, for a column that
-- carries no meaning — nothing references `business_settings.id` as a foreign
-- key. Dropping only the CHECK constraint allows ids 1..N, the existing row keeps
-- its id, and the change is reversible with a single `add constraint`. The branch
-- column is what identifies a settings row; the integer id is now an artefact.

-- ─── 1. Branches ────────────────────────────────────────────────────────────

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  -- Short code used for document references (`BAL-0001`) and anywhere a branch
  -- has to fit in a fixed-width label. Uppercase, no spaces, so it stays
  -- readable in a printed receipt header.
  code text not null unique check (code ~ '^[A-Z][A-Z0-9]{1,7}$'),
  name text not null check (length(btrim(name)) > 0),
  address text not null default '',
  -- Per-branch rather than global: two branches in different regions could in
  -- principle operate in different zones, and the analytics function already
  -- derives calendar dates from a zone of this shape.
  time_zone text not null default 'Asia/Manila' check (length(btrim(time_zone)) > 0),
  -- Kept for a branch that closes: rows keep pointing at it, so this is a flag
  -- rather than a delete. Nothing filters on it yet; it exists so that removing
  -- a branch later does not require a schema change on live data.
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger branches_set_updated_at
before update on public.branches
for each row execute function public.set_updated_at();

alter table public.branches enable row level security;

-- Same shape as every other table in this schema: authenticated clients may read,
-- and every write goes through the backend service role, which bypasses RLS.
create policy "authenticated users can read branches"
on public.branches for select
to authenticated
using (true);

grant select on public.branches to authenticated;
grant select, insert, update, delete on public.branches to service_role;

-- Balayan is where the existing data will land in Phase 2, and it is the branch
-- every current profile is assigned to below. Its id is captured deterministically
-- by code, so this migration and the ones after it do not have to hard-code a uuid.
insert into public.branches (code, name, address)
values
  ('BAL', 'Balayan', ''),
  ('NAS', 'Nasugbu', '')
on conflict (code) do nothing;

comment on table public.branches is
  'The physical shops. Every operational row belongs to exactly one branch (added in Phase 2); staff see only their own.';

-- ─── 2. Per-branch business settings ────────────────────────────────────────

-- Drop the singleton guard. Reversible: re-adding the constraint succeeds as long
-- as no row with another id exists.
alter table public.business_settings
  drop constraint if exists business_settings_id_check;

alter table public.business_settings
  add column if not exists branch_id uuid references public.branches(id) on delete restrict;

-- The existing row is Balayan's — it holds the owner's real logo, business name,
-- VAT rate and zone, and all data currently in the system belongs to Balayan.
update public.business_settings
set branch_id = (select id from public.branches where code = 'BAL')
where branch_id is null;

-- One settings row per branch, enforced by the database rather than by the
-- service layer. No backfill is possible if this fails, so it fails loudly here
-- rather than silently producing two rows that a `.single()` read would reject.
alter table public.business_settings
  alter column branch_id set not null;

alter table public.business_settings
  drop constraint if exists business_settings_branch_id_key;
alter table public.business_settings
  add constraint business_settings_branch_id_key unique (branch_id);

-- `id` still carries `default 1`, which would make the *next* insert collide with
-- the existing Balayan row. A sequence is this schema's normal answer and needs no
-- change to the client, which never sends an id.
--
-- ⚠ This MUST run before the Nasugbu insert below, and the ordering is load-
-- bearing rather than cosmetic. The Balayan row already occupies `id = 1`; while
-- the default is still the literal `1`, the very next insert into this table —
-- Nasugbu's settings row — asks for id 1 a second time and dies on
-- `business_settings_pkey`. That is not a theoretical risk: it is what the
-- migration-replay gate caught (44/46 applied, FAILED at this file), and it
-- would have aborted `supabase db push` in production because Supabase runs each
-- migration in a single transaction. Creating the sequence and switching the
-- default first is what makes the insert legal.
create sequence if not exists public.business_settings_id_seq;

select setval(
  'public.business_settings_id_seq',
  greatest((select coalesce(max(id), 0) from public.business_settings), 1)
);

alter table public.business_settings
  alter column id set default nextval('public.business_settings_id_seq');

alter sequence public.business_settings_id_seq owned by public.business_settings.id;

-- Give Nasugbu an empty row so the settings screen has something to read on day
-- one. The name is seeded from the branch so the UI is never blank; the logo is
-- deliberately null (the UI renders the business initials) because Nasugbu's
-- artwork does not exist yet.
--
-- `branch_id` is the conflict target, not `id`: the row's identity as "Nasugbu's
-- settings" is the branch, and `id` is now just the sequence's output.
insert into public.business_settings (branch_id, business_name)
select b.id, 'IC Printing Services - ' || b.name
from public.branches b
where b.code = 'NAS'
on conflict (branch_id) do nothing;

comment on column public.business_settings.branch_id is
  'The branch these settings belong to. Exactly one row per branch (unique). Identifies the shop; `id` is now just a surrogate key.';

-- ─── 3. Staff membership and the head-office exception ──────────────────────

alter table public.profiles
  add column if not exists branch_id uuid references public.branches(id) on delete restrict;

-- Every existing account belongs to Balayan — that is where the data is and where
-- the staff currently work.
update public.profiles
set branch_id = (select id from public.branches where code = 'BAL')
where branch_id is null;

-- Nullable on purpose, and this is a deliberate decision rather than an omission.
--
-- A user is provisioned in this order: `auth.admin.createUser` creates the auth
-- row, then the service inserts the profile. `loadAuthContext` filters the login
-- by `profiles.id` and immediately rejects a 403 `PROFILE_NOT_PROVISIONED` when
-- no row matches, so a profile that does not exist yet cannot be a member of any
-- branch. Making the column NOT NULL here would add nothing (the existing rows are
-- all backfilled above) while turning a partial failure — auth row created,
-- profile insert rejected — into an orphaned account that can never be repaired
-- and can never be cleaned up by the normal user-delete path.
--
-- Phase 2 tightens this to NOT NULL in the same migration that gives the
-- operational tables a branch, once membership is enforced on every write.
comment on column public.profiles.branch_id is
  'The branch this account belongs to. Nullable only because the auth row is created before the profile row; every provisioned profile has one. Tightened to NOT NULL in the Phase 2 migration.';

alter table public.profiles
  add column if not exists can_view_all_branches boolean not null default false;

comment on column public.profiles.can_view_all_branches is
  'Head office / owner only. Grants read-across access for analytics. This is a permission, not a role: granting it must be a deliberate act, and the value is auditable. Does NOT grant cross-branch writes.';

-- The owner asked for a role several people share. Create it as a real role so it
-- is assigned the same way every other role is, rather than by hand-editing a
-- boolean on each account.
--
-- `app_role` is seeded with ('admin', 'staff'). `roles.name` is typed on that enum,
-- so the value has to exist before this row can name it; the alternative —
-- overloading `admin` — would have made "can see both branches" and "manages the
-- system" the same thing, which the owner explicitly did not ask for.
--
-- ⚠ The enum value itself is added by the migration *immediately before* this one
-- (`20261002000150_app_role_owner_enum.sql`), not here. PostgreSQL rejects using an
-- enum value in the same transaction that added it, and Supabase wraps each file
-- in one transaction, so `alter type ... add value` followed by this `insert`
-- cannot share a file — it fails with `unsafe use of new value "owner" of enum
-- type app_role`. Splitting them is what lets the value be used at all.

insert into public.roles (name, description)
values ('owner', 'Owner / head office. Full read access across branches for reporting.')
on conflict (name) do nothing;

-- The owner sees everything the admin sees. Enumerating rather than saying "all
-- permissions" so a permission added later has to be granted deliberately instead
-- of silently landing on the owner role.
insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
cross join public.permissions
where roles.name = 'owner'
on conflict do nothing;
