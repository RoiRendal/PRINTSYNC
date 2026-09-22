# PRINTSYNC — Architecture Review

**Date:** 2026-09-21
**Branch reviewed:** `flat-ui` (working tree, clean)
**Scope:** `backend/src`, `frontend/src`, `supabase/migrations`, `packages/shared-types`, deploy config
**Status:** findings + prioritized fix list

---

## What this is, and how to read it

A read-only health check of the three surfaces, done **before** we add or adjust features. Nothing in
the repository was modified to produce it.

**Method.** Three independent sweeps — backend, frontend, database/contract/deploy — plus
verification of the highest-stakes findings by hand. Every claim below cites a file and line. Where
something could not be confirmed from the repository, it is marked **UNVERIFIED** rather than guessed.

**Not covered:** the live Supabase project's actual contents, the GitHub ruleset itself, and any
behaviour that only appears at runtime. These are listed in §6.

**Sections 1–3 are the findings.** Section 4 is the ranked fix list, and it is the disposable half —
if you want to write the plan yourself, keep 1–3 and throw 4 away.

---

## 1. The system as it stands

### Size, measured

| Surface | Files | Lines | Shape |
| --- | ---: | ---: | --- |
| `backend/src` | 57 | 10,522 (with tests) | 18 route files · 12 module services · 4 middleware · 7 cross-cutting services |
| `frontend/src` | 124 | 14,758 | 10 pages · ~40 components · 7 stores · 14 API modules · 11 test files |
| `packages/shared-types/src` | 13 | 349 | types only, plus 3 runtime constants |
| `supabase/migrations` | 28 `.sql` | — | 19 tables · 27 capability keys · 11 functions (9 names) |

Tests: **256 backend cases / 18 files**, **152 frontend cases / 11 files**. No end-to-end suite.

### How a request flows

```
Browser (React 19 + Vite)
  │   zustand list stores ← one factory (createListStore): 15s staleTime, optimistic writes
  │   all HTTP through ONE module (shared/api/client.ts)
  ▼  cookie JWT (HttpOnly, SameSite=Lax)
Express  (routes → capability middleware → module service)
  │   the ONLY authorization boundary: requirePermission() per route
  ▼  service-role key  ← bypasses RLS entirely
Postgres (Supabase)
      multi-table writes only inside SECURITY DEFINER RPCs with FOR UPDATE locks
      structured errors: raise exception … using detail = json_build_object(…)

Realtime: SSE  GET /api/v1/events  ← published from the route layer AFTER the write commits
          in-process event bus  →  single-instance only
```

### What is genuinely strong

This is a well-built system, and the review should not read as if it isn't. Specifically:

- **The boundaries hold.** The frontend contains **zero** Supabase imports and no Supabase
  dependency. The service-role key never leaves the server. This is the convention most projects
  break; this one didn't.
- **Atomicity is in the right place.** Every multi-table write is a `SECURITY DEFINER` RPC with row
  locks and explicit insufficient-stock rejection. The API layer never fakes a transaction.
- **The money-safety design is genuinely good**, not just present: an idempotency key with a partial
  unique index, a replay guard that runs *before* validation, compare-and-swap on `updated_at` for
  order edits, a first-class `unknown` checkout outcome, and a reconciliation endpoint that returns
  `200 {data: null}` rather than `404` when nothing committed. That last detail is the kind of thing
  most teams get wrong for months.
- **Zero `TODO`, `FIXME`, `HACK`, `@ts-ignore`, `as any`, or stray `console.log`** anywhere in
  application code. The debt here is structural, not "we'll fix it later" litter.
- **The freshness model is coherent** — one event bus for cross-domain invalidation, a 15s
  stale-time, and an explicit rule that only an authoritative signal forces a revalidate.

So the findings below are about a system that got the hard parts right and has specific, fixable
gaps — not a system in trouble.

---

## 2. Risk register

Severity: **Blocker** = cannot provision an environment · **High** = can produce wrong money, wrong
records, or wrong access · **Medium** = will bite · **Low** = hygiene.

| # | Risk | Lens | Severity |
| --- | --- | --- | --- |
| R1 | Database cannot be rebuilt from scratch — duplicate index name aborts the migration set | Deployability | **Blocker** |
| R2 | Two stale database functions are still live; a call can land on an old body | Correctness | **High** |
| R3 | All dates are UTC, not shop-local — daily sales and order dates are wrong for the first 8 hours of every day | Correctness | **High** |
| R4 | `trust proxy` never set — audit log records the proxy's IP, rate limiter keys on it | Security / Ops | **High** |
| R5 | Anyone who can record an order payment can also delete one | Security | **High** |
| R6 | `users.read` enforced by no route; HTTP and realtime disagree about reading users | Security | Med-High |
| R7 | `Order.updatedAt` missing from the shared contract; 7 frontend files hand-copy types | Correctness | Medium |
| R8 | Audit writes are best-effort — a money action can commit with no audit row | Correctness | Medium |
| R9 | No server timeouts — a stalled client holds a socket indefinitely | Ops | Medium |
| R10 | No global rate limit — only login and refresh are throttled | Security | Medium |
| R11 | `POSPage.tsx` is 902 lines and bypasses the store layer | Maintainability | Medium |
| R12 | No E2E suite; the flat-UI gate exists but nothing runs it | Process | Medium |
| R13 | Analytics computed twice, with a silent fallback that already hid a broken query | Correctness | Medium |
| R14 | No request IDs — a failed checkout cannot be traced through the logs | Ops | Low-Med |
| R15 | Dead schema and unused code (`purchase_orders`, unused exports, redundant indexes, unindexed FKs) | Maintainability | Low |

### Two architectural facts that are not bugs, but that you should know

- **The route layer is the only lock on the door.** All 19 tables have row-level security enabled,
  but the API connects with the service-role key, which bypasses RLS completely. RLS is latent
  defence-in-depth for a client path that does not exist. Practically: **one route that forgets
  `requirePermission` is fully exposed.** Nothing else catches it.
- **The system is single-instance by design.** The realtime bus is in-process and the auth context is
  cached for 30 seconds in memory. That matches the one-instance deploy we have, and it is the right
  call at this scale — but it means "add a second server" is not a scale-out option without moving
  the bus out, and a permission change takes up to 30s to take effect.

---

## 3. Findings in detail

### A. Correctness and data

**R1 — The database cannot be rebuilt from scratch. (Blocker)**

`orders_customer_idx` is created twice with the same name:

- `supabase/migrations/20260910001000_orders.sql:24` — a GIN text-search index
- `supabase/migrations/20260910002100_order_due_date.sql:4` — a btree on `customer_id`

There is **no `drop index` anywhere** in the 28 migrations. On a fresh `supabase db push` the second
statement aborts, and because Supabase runs each migration in one transaction, that migration's
`customer_id` and `due_date` columns roll back with it — which would then break the order functions
that depend on them.

**Business impact:** we have exactly one working database and no proven way to create a second. No
staging environment, no safe way to recover if the Supabase project is ever lost, and a new developer
cannot stand the system up. This is the single most important item in the review.

**UNVERIFIED:** the live database plainly *does* have `customer_id` (the order functions use it and
work), so the live state cannot match the migration files. Only a query against the live project can
settle which index currently owns the name. The fix in §4 is deliberately written to converge from
either state.

**R2 — Two stale database functions are still live. (High)**

`create_order_with_items` exists as **both** 7-argument and 9-argument; `replace_order_with_items`
exists as **both** 8-argument and 11-argument. The wider versions add `customer_id`/`due_date` and —
for `replace` — the conflict check. Only two `drop function` statements exist in the entire migration
set, so the old arities were never removed.

**Business impact:** the code today always calls the wide version, so nothing is broken *right now*.
But an older call shape resolves to the old function body, which silently drops the customer and due
date and skips the "has this order changed underneath me?" check. That is a latent landmine for the
next person who writes a caller.

**R3 — All dates are UTC, not shop-local. (High)**

Three places derive a calendar date by slicing a UTC timestamp:

- `backend/src/modules/orders/orders.service.ts:87` — `date: String(row.created_at).slice(0, 10)`
- `backend/src/modules/analytics/analytics.service.ts:102` — `toDateKey()` returns `value.slice(0, 10)`
- `backend/src/modules/expenses/expenses.service.ts:60` — `new Date().toISOString().slice(0, 10)`

and the analytics RPC groups by `to_char(created_at, 'YYYY-MM-DD')`
(`supabase/migrations/20260917000000_fix_analytics_summary_rpc.sql:56,61`), which uses the session
time zone — UTC on Supabase.

**Business impact:** the Philippines is UTC+8, so **every sale made before 08:00 local time is filed
under the previous day.** The daily revenue series, the order's displayed date, and the default
expense date are all off by one day for the first eight hours of every shift. For a shop that does a
daily closing, "yesterday's sales" is simply wrong in the morning. This is the finding most likely to
be noticed by staff, and it is cheap to fix.

The two analytics implementations agreeing today is an accident of both being UTC — change one and
they silently diverge (see R13).

**R7 — The order contract has drifted, and the token that protects edits is missing. (Medium)**

`packages/shared-types/src/order.ts:17-33` has **no `updatedAt`** — yet `updatedAt` is required by
the backend (`orders.service.ts:40,88`) and by the frontend (`features/orders/types.ts:37`), and it is
the compare-and-swap token that stops two people overwriting each other's order edits.

Seven frontend files hand-copy shared types instead of re-exporting them
(`features/{inventory,designs,orders,users,audit}/types.ts`, `orders/api/paymentsApi.ts`,
`orders/api/orderPaymentsApi.ts`). Only `features/customers/types.ts` does it correctly. The copies
have already diverged — `InventoryItem` is missing `costPrice`, `Order` makes fields optional that the
API always returns, `Design` makes fields optional that the database always fills.

**Business impact:** the shared contract is meant to be the single description of the domain. It
isn't. A future re-copy can quietly drop the version token, and the lost-update protection on order
edits stops working without any test failing.

**R8 — Audit writes are best-effort, not atomic. (Medium)**

`backend/src/services/auditLogService.ts:25-33` swallows a failed audit write (logs a warning,
returns `false`) and every caller ignores the return value — including the money routes
(`orders.routes.ts:67,81,94`) and login (`auth.routes.ts:49,67,133`).

**Business impact:** an action can succeed while its audit row is silently lost. The audit log is the
only record that a hard delete happened, since there is no soft delete anywhere in the schema — so a
lost audit row can mean an unrecoverable, unrecorded deletion.

**R13 — Analytics is implemented twice, with a fallback that hides failures. (Medium)**

`analytics.service.ts:117-121` calls the `get_analytics_summary` RPC; lines `123-199` silently fall
back to client-side aggregation when it fails, logging only a warning. The RPC's own repair migration
notes that this fallback is why a broken query stayed invisible
(`20260917000000_fix_analytics_summary_rpc.sql:17-21`).

**Business impact:** the dashboard can show numbers computed by a different code path from the one we
think is authoritative — and if the two ever disagree, nothing tells anyone. A silent fallback on a
money figure is worse than an error.

### B. Security and access control

**R4 — `trust proxy` is never set. (High)**

Grep of `backend/src` returns no match for `trust proxy`. Production runs behind Render's proxy.
Consequences: `request.ip` — written into `audit_logs.ip_address` at `auth.routes.ts:53,72,138` —
records the proxy, not the staff member; and the login/refresh rate limiters (`auth.routes.ts:14-28`)
key on the proxy address.

**Business impact:** the audit trail cannot answer "who logged in from where". Worse, if every client
shares one rate-limit bucket, one person can lock out the whole shop — or the limiter does nothing at
all.

**UNVERIFIED:** whether `express-rate-limit@8` errors or merely warns in this configuration. The
setting is confirmed absent; the runtime effect was not executed.

**R5 — Anyone who can record an order payment can also delete one. (High)**

`orderPayments.routes.ts:43` gates `DELETE /order-payments/:id` on `order_payments.create`, because no
`order_payments.delete` capability exists — only `.read` and `.create` are seeded
(`20260910002300_permissions.sql:5-6`). Compare `payments.void`, which is correctly admin-only.

**Business impact:** deleting a payment changes what a customer owes. Today, the staff ability to
record a payment carries the ability to erase one, with no separate permission to grant or withhold.

**R6 — `users.read` is a dead capability, and the two layers disagree. (Medium-High)**

`users.routes.ts:32` gates the *entire* users router — including `GET /users` — on `users.manage`.
Meanwhile `services/dataChangePermissions.ts:27` gates the realtime `users` domain on `users.read`,
and no route enforces `users.read` at all.

**Business impact:** limited today (both permissions are admin-only, so nobody gains access), but the
two layers disagree about what "may see users" means, and the read permission that exists on paper
does nothing. It becomes a real hole the moment a read-only role is introduced.

**Also worth noting, lower severity:** `GET /api/v1/ready` is unauthenticated and reports dependency
readiness for six internal tables to anonymous callers. Low risk, but it is unthrottled and
unnecessary in public.

**R10 — No global rate limit. (Medium)** Only login (10/15min) and refresh (20/15min) are throttled.
Every other endpoint, including image upload, is unthrottled.

### C. Maintainability and velocity

**R11 — `POSPage.tsx` is 902 lines. (Medium)**

`frontend/src/features/orders/pages/POSPage.tsx` owns the cart, checkout orchestration,
reconciliation, transaction history, receipt state, order-edit hydration, keyboard shortcuts and
printing — and it calls `paymentsApi` directly instead of going through the store layer. It is the
only component in the frontend that does so (three other files call an API directly, all for
legitimate reasons: a blob download, branding, and a modal's payment list).

**Business impact:** the till is the one screen where a mistake costs money, and it is the hardest
file in the codebase to change safely. Any new POS feature carries avoidable risk.

**R12 — No E2E coverage, and the flat-UI gate is not wired into CI. (Medium)**

`frontend/scripts/check-flat-ui.mjs` exists and passes (`pass, scanned 113 files`), but
`.github/workflows/ci.yml` never invokes it — so the entire flat-UI effort is unprotected against
regression. There is no Playwright or Cypress config anywhere in the repo; the `playwright` dependency
in `frontend/package.json` is unused by the app.

**Business impact:** nothing automated catches "the screen looks wrong", and nothing automated proves
a checkout works end to end. A human's eyes on `npm run dev` remain a required step.

**R14 — No request IDs. (Low-Med)** Log lines cannot be tied to a single request, so a failed
checkout cannot be traced across the log stream.

**R15 — Dead code and schema hygiene. (Low)** `purchase_orders` has no API surface at all (written
only by the demo seeder). Four dead exports (`designImagePublicUrl`, `usersApi.refresh`,
`orderPaymentsApi.remove`, `customersApi.get`). `TableContainer`'s `raisedHeader` prop is accepted and
ignored; `CardVariant`'s `solid` and `elevated` render identical classes. Two indexes on
`sales_transaction_items(transaction_id)` are exact duplicates. Twelve foreign keys have no index.
`playwright` sits in runtime dependencies while being unused. And the "AI insights" panel
(`analytics-types.ts:62-163`) is a client-side template generator presented as analysis — worth a
deliberate decision on whether to keep it, label it, or remove it before release.

---

## 4. Prioritized fix list

Ordered by what must happen first. Each item names the files, the change, and how to prove it worked.
`[LIVE]` = must run against the real Supabase project · `[LOCAL]` = runs locally or in CI.

> **Status, updated 2026-09-22 — the plan is complete and everything is pushed.** Every fix in Tiers
> 0, 1, 2 and 3 is **done, verified and pushed** to `origin/flat-ui` (HEAD `f391b32`). Tier 3.1
> decomposes `POSPage.tsx` from 902 to 294 lines across eight hooks/components plus a real
> `usePaymentStore` (`7797a8d`), and its visual no-op is now **confirmed by eye** — the till renders
> the same as it did before the split. **1.5 and its follow-up are pushed** (`7b22079`, `dc18c03`):
> the seven hand-copied frontend type files are converted to re-exports and both drift guards are in
> place. Read the sections below as the original findings — the plan is complete.
>
> **Migrations verified against the live project, 2026-09-22.** Confirmed present rather than assumed:
> `business_settings.time_zone` = `Asia/Manila` (1.1); `order_payments.delete` seeded and held by
> `admin` only, while `staff` keeps read and create (1.3); `write_audit_log` accepts `p_request_id`
> (2.2); all five money RPCs carry the three `p_audit_*` parameters (2.1); and `orders.customer_id`
> and `orders.due_date` both exist on live, so 0.1's blast radius did not materialise.
>
> **Two of those are still unverified.** 0.1's index names and 0.2's dropped overloads need
> `pg_indexes` and `pg_proc`, which the REST API cannot reach — only a SQL session can settle them.
> Treat 0.1 and 0.2 as applied-but-unproven until someone runs those two queries.
>
> | Tier | State | Commits |
> | --- | --- | --- |
> | 0 — 0.1, 0.2 | done, applied live, replay proven | `94a6168` |
> | 1 — 1.1 | done, verified against real PostgreSQL | `5158875` |
> | 1 — 1.2 | done | `0bbda8c` |
> | 1 — 1.3 | done, **migration must be applied before deploy** | `d39161f` |
> | 1 — 1.4 | done; a third role is still a design decision | `142d5ae` |
> | 1 — 1.5 | **done, pushed** — contract repaired in `8cf0f34`; the seven hand-copied frontend type files converted to re-exports; two drift guards added; `CreateTransaction` no longer requires `status` | `8cf0f34`, `7b22079`, `dc18c03` |
> | 2 — 2.2 | done, verified end to end | `a748710` |
> | 2 — 2.1 | done, atomicity proven against real PostgreSQL; **two migrations must be applied before deploy** | `e409a31` |
> | 2 — 2.3 | done — **but wrong in two places; see correction under 2.3** | `3028781` |
> | 2 — 2.4 | done | `da45b30` |
> | 3 — 3.2 | done, pushed — flat-UI CI gate + E2E scaffold | `5be4e2d` |
> | 3 — 3.3 | done, pushed — single analytics path | `44281a1` |
> | 3 — 3.4 | done, pushed — `playwright` → devDependencies | `5be4e2d` |
> | 3 — 3.5, 3.6 | done, pushed — drop dup index + index twelve FKs | `c2a4006` |
> | 3 — 3.7 | done, pushed — dead exports/UI + `purchase_orders` reserved | `39422de` |
> | 3 — 3.1 | done, pushed — decompose `POSPage.tsx` (902 → 294) into 8 hooks/components + `usePaymentStore` | `7797a8d` |
>
> Three items were found while doing the work and are not in the lists below:
> `OrderPayment.createdBy` was missing from the contract (same class as R7, fixed in `8cf0f34`); the
> frontend type-check had been failing on this branch since `fbfb0a1` (fixed in `c2b9d90`); and
> money audit rows carried **no IP address and no user-agent** — only the auth and users routes
> passed them, which left the 1.2 `trust proxy` fix inert for exactly the actions that matter
> (fixed in `a748710`).
>
> **Two of this review's own claims did not survive measurement.** They are corrected inline rather
> than quietly dropped, because a fix list that keeps a wrong instruction in it is worse than one
> with a visible scar:
>
> - **2.3's `requestTimeout = 30_000` was wrong — 120 s shipped.** `requestTimeout` bounds *receiving*
>   a request, not how long a handler may run. An 8 MB base64 image upload on a slow shop uplink
>   legitimately exceeds 30 s, so the recommendation would have broken logo uploads and presented as
>   anything but a timeout.
> - **2.3's premise that the SSE exemption is what keeps realtime alive was wrong.** Measured: an
>   event stream held open for 75 s survives **with and without** `request.setTimeout(0)`, because by
>   then the request had been fully received. The exemption still ships, but as a documented guard,
>   not a rescue.

### Tier 0 — Restore the ability to provision an environment

**0.1 — Fix the duplicate index name (R1). Blocker.**

- **Files:** NEW `supabase/migrations/20260921000000_fix_orders_customer_index.sql`;
  EDIT `20260910002100_order_due_date.sql:4`; EDIT `20260910001000_orders.sql:24`.
- **Change:** new migration drops the ambiguous name and recreates both indexes unambiguously
  (`orders_customer_id_idx` btree, `orders_customer_fts_idx` GIN). The two old files get the new names
  plus `if not exists`.
- **Convention conflict — an explicit exception to "never edit a pushed migration."** Justification: a
  forward-only migration cannot stop an *earlier* migration from aborting, so replay-ability is
  impossible without editing. The edit is purely defensive — on any database where it already applied
  it produces an identical schema, so it cannot change live state. Record it as an intentional
  exception in the commit message.
- **Verify:** `[LIVE]` `select indexname, indexdef from pg_indexes where schemaname='public' and
  tablename='orders' order by 1;` → both new names present, old name gone.
  `[LOCAL]` `supabase db reset` completes with no error — **fails today, passes after.**
- **Risk:** low. The GIN index is referenced by no query (orders list by `created_at`), so recreating
  it is inert.
- **Ordering:** must be first.

**0.2 — Drop the stale function overloads (R2). High.**

- **Files:** NEW `supabase/migrations/20260921000100_drop_stale_order_rpc_overloads.sql`.
- **Change:** `drop function if exists public.create_order_with_items(text, text, numeric, text,
  boolean, uuid, jsonb);` and `drop function if exists public.replace_order_with_items(uuid, text,
  text, numeric, text, boolean, jsonb, uuid);`
- **Verify:** `[LIVE]` `select p.proname, pg_get_function_identity_arguments(p.oid) from pg_proc p join
  pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in
  ('create_order_with_items','replace_order_with_items');` → **4 rows today, 2 rows after.**
- **Risk:** low. The backend already calls the widest arity; after the drop, an old call shape
  resolves to the wide version via its defaults, which is the desired behaviour.
- **Ordering:** after 0.1.

### Tier 1 — Money and access correctness

**1.1 — Make dates shop-local (R3). High.**

- **Files:** `backend/src/modules/orders/orders.service.ts:87`;
  `backend/src/modules/analytics/analytics.service.ts:102` (`toDateKey`);
  `backend/src/modules/expenses/expenses.service.ts:60`; and the grouping in
  `20260917000000_fix_analytics_summary_rpc.sql:56,61`.
- **Change:** add a `time_zone` column to `business_settings` (default `Asia/Manila`) and derive every
  calendar date through it — in Node with `Intl.DateTimeFormat('en-CA', { timeZone })` (yields
  `YYYY-MM-DD`), and in SQL with `(created_at at time zone <shop tz>)::date`. **Never slice a UTC ISO
  string.**
- **Verify:** `[LOCAL]` a unit test with a fixed instant of `2026-09-21T17:30:00Z` (01:30 Manila on
  the 22nd) asserts the date is `2026-09-22` — **fails today (returns the 21st), passes after.**
  `[LIVE]` compare the analytics daily series before and after over a range covering a morning sale.
- **Risk:** medium blast radius, low technical risk — it changes displayed dates and the daily series
  grouping, which is the point. Do it as its own commit so the before/after numbers can be compared.

**1.2 — Set `trust proxy` (R4). High.**

- **File:** `backend/src/app.ts`, immediately after `const app = express();` (~line 103).
- **Change:** `app.set('trust proxy', 1);` — a **number**, not `true`; `express-rate-limit` rejects
  `true` as permissive.
- **Verify:** `[LOCAL]` a test sending `X-Forwarded-For: 203.0.113.7` asserts the audit row's
  `ipAddress` is that address — **fails today.** `[LIVE]` after a few logins, group
  `audit_logs.ip_address` by count → distinct client IPs instead of one proxy IP.
- **Risk:** low on Render (exactly one proxy hop). Document that the process must not be exposed
  without a proxy, or the header can be spoofed.

**1.3 — Give payment deletion its own capability (R5). High.**

- **Files:** NEW `supabase/migrations/20260921000200_order_payments_delete_permission.sql`;
  `backend/src/routes/orderPayments.routes.ts:43`.
- **Change:** seed `order_payments.delete` and grant it to `admin` only, mirroring `payments.void`;
  switch the route to `requirePermission('order_payments.delete')`.
- **Verify:** `[LIVE]` the grant query returns only `admin`. `[LOCAL]` a staff token gets 403 on
  DELETE; an admin token gets 204.
- **Risk:** low, and it deliberately removes a power staff have today. The frontend never calls
  `orderPaymentsApi.remove`, so no UI change is needed.
- **Ordering:** the migration must land **before** the route change, or every delete 403s.

**1.4 — Make `users.read` real (R6). Medium-High.**

- **File:** `backend/src/routes/users.routes.ts` — remove the router-wide guard at line 32; gate
  `GET /` on `users.read` and the write routes on `users.manage`.
- **Why this side moves:** `users.read` is already seeded and already used by the realtime filter and
  the page map. Moving the realtime filter instead would permanently stop a read-only role from ever
  receiving user events.
- **Verify:** `[LOCAL]` a token with `users.read` but not `users.manage` gets 200 on `GET /users` and
  403 on `POST /users`.
- **Risk:** low — no visibility change today (both keys are admin-only). Flag: the frontend derives
  `role` from `users.manage` (`useAuthStore.ts:29`) and preloads the user store only when
  `canManageUsers` (`app/stores/index.ts:39-47`); update both in the same PR or track it.

**1.5 — Repair the order contract and stop future drift (R7). Medium.**

- **Files:** `packages/shared-types/src/order.ts:17-33` (add `updatedAt: string` with a comment
  explaining it is the version token); `frontend/src/features/orders/types.ts` and the other six
  hand-copied files → convert to `export type { … } from '@printsync/shared-types'`, following
  `features/customers/types.ts`; NEW compile-time guard
  `frontend/src/shared/contracts/contract-guard.ts` asserting the local and shared types are mutually
  assignable, plus `frontend/scripts/check-shared-types.mjs` failing when a feature file re-declares a
  name the package exports.
- **Verify:** `[LOCAL]` remove `updatedAt` from the shared type → `cd frontend && npm run lint`
  **fails** (proving the guard bites); restore → passes. Then `npm run lint && npm test` in both
  workspaces.
- **Risk:** medium — reconciling the optionality differences will surface real mismatches. That is the
  intended outcome; fix them deliberately rather than silencing them. Type-only imports keep the "not
  aliased in Vite" rule intact.
- **Ordering:** shared package first (CI builds it before the backend).

> **As shipped, 2026-09-21 (local commit, not pushed).** The contract itself was repaired earlier, in
> `8cf0f34` — `Order.updatedAt` and `OrderPayment.createdBy` restored. What remained was the seven
> frontend files that hand-copied types instead of re-exporting them. All seven now read
> `export type { … } from '@printsync/shared-types'`, following `features/customers/types.ts`.
>
> **The reconciliation surfaced real mismatches, exactly as this entry predicted — and they were the
> frontend's, not the contract's.** `CreateOrder` correctly omits `item` and `quantity` because the API
> derives both from `lineItems` (`orders.service.ts:86-88`), so the two call sites still *sending* them
> were the defect. Three copies had quietly made contract-required fields optional —
> `InventoryItem.costPrice`, `Order.lineItems`, `Design.assetType`/`assetSizeBytes` — and the fix adopts
> the stricter shared shape and repairs the consumers rather than loosening the contract.
> `UserSummary.access` widened from `PageAccessKey[]` to the contract's `string[]`, so `normalizeAccess`
> clamps rather than assumes. Every change is behaviour-preserving: the five money tests and all 240
> frontend tests stayed green throughout.
>
> **The one contract oddity is now resolved (2026-09-22).** The shared `CreateTransaction` used to
> *require* a `status`, but the API's `TransactionInput` has never carried one — the sale RPC sets it.
> The POS call site passed `'completed'` purely to satisfy the type, and the server ignored it. The
> contract was tightened rather than the call site worked around:
> `CreateTransaction = Omit<Transaction, 'id' | 'date' | 'status'>`. The create-side shape no longer
> offers a field the server owns — a client able to set `status` could claim a state the ledger never
> passed through — and `usePOSCheckout` no longer sends one. This is the follow-up that 1.5
> deliberately left open; the reasoning for *not* doing it inside a frontend drift fix still holds,
> which is why it lands as its own change.
>
> **Two guards, because `tsc` alone cannot catch a re-introduced copy** — a hand-written type is still a
> valid type, and the original defect was a *valid* hand-written type:
>
> - `frontend/src/shared/contracts/contract-guard.ts` — compile-time `Identical` assertions that each
>   feature module's exported type *is* the published one, a derived-types block for the deliberate
>   narrowings (`CartItem`, `AuthUser`, …), and a named assertion for `Order.updatedAt`.
> - `frontend/scripts/check-shared-types.mjs` — reads the source and refuses a *declaration* of a name
>   the package owns, with one documented `ALLOW` entry (the history table's own `Transaction`, a
>   different concept that shares the name). Wired to `npm run check:shared-types` and into the CI
>   `frontend` job.
>
> **Proof, both directions.** Re-introducing the original defect — a hand-copied `Order` without
> `updatedAt` — makes the source gate exit 1 naming the file, and `tsc` fail on `contract-guard.ts`
> with `Type 'false' does not satisfy the constraint 'true'`. Both files were then restored
> byte-identically (verified with `cmp`) and the gates re-run green. Green after restore:
> `packages/shared-types` untouched (git clean, `dist/` current, so the backend is unaffected);
> frontend `lint`, `check:shared-types`, `check:flat-ui` and `test` (240/240); backend `lint`,
> `lint:tests` and `test:unit` (255/255).
>
> **Not run: the migration replay gate.** This change touches no SQL — only `.ts` files — so the
> replay would prove nothing it has not already proven.

### Tier 2 — Operational robustness

**2.1 — Make audit writes atomic for money actions (R8). Medium.**
Extend the money RPCs to insert their own audit row before returning, so it commits or rolls back with
the action. Adding a parameter means the old arity must be dropped first — the same pattern as
`20260916000000:39`. Short term, escalate the swallowed warning in `auditLogService.ts:25-33` to an
error. Verify by forcing the audit insert to fail in a scratch database and asserting the sale rolls
back. **Ordering: after 0.2.** Highest-touch item in the list — it edits the money RPC.

> **As shipped, 2026-09-21 (`e409a31`).** `supabase/migrations/20260921000500_atomic_audit_writes.sql`
> drops and recreates **five** money RPCs — `create_order_with_items`, `replace_order_with_items`,
> `delete_order_with_items`, `create_transaction_with_payment`, `void_transaction` — each gaining three
> **trailing defaulted** audit parameters (`p_audit_request_id`, `p_audit_ip_address`,
> `p_audit_user_agent`) and a `perform public.write_audit_log(...)` immediately before `return`.
> Trailing defaults are deliberate: a backend still on the previous version sends the old argument
> count and resolves to the *same* function, so the migration can be applied **before** the code
> deploys. Idempotency replays return early and write **no** audit row.
>
> **A trap this list missed.** Moving `order.updated` into `replace_order_with_items` while leaving the
> route's own write in place would have produced **two audit rows per line-item edit**. Handled by
> splitting the paths: the line-item path audits inside the RPC, the status-only path (which has no
> RPC) audits at the route, guarded by `if (updates.lineItems === undefined)`.
>
> **Not covered, by design.** Deletes with no RPC (customers, suppliers, designs, expenses, inventory
> items) and the two `order_payments` writes still audit from the route, after the fact. Because
> `writeAuditLog` now throws, those callers get a 500 **after** their action has already committed —
> the action happened and is not recorded. The durable fix is an RPC each; out of scope here.
>
> **Proof:** `…/printsync-migration-integrity-verification/scripts/verify-atomic-audit.mjs` — 28
> checks, including a `pg_get_functiondef` body-fidelity diff against the originals and an atomicity
> test that forces `write_audit_log` to raise and asserts the sale, the void and the order delete all
> refuse *for the audit reason*.

**2.2 — Add request IDs (R14). Low-Med.**
NEW `backend/src/middleware/requestId.ts` accepting `x-request-id` or minting a UUID, echoing it in
the response header and into every log line and audit `metadata`. Register early in `app.ts`. Verify
with `curl -i` and by matching a log line to the response header. **Do this before 2.1** so the ID is
available to it.

> **As shipped, 2026-09-21 (`a748710`).** Implemented with `AsyncLocalStorage`
> (`backend/src/shared/requestContext.ts`) rather than by threading an id through every signature —
> the id is only useful if it lands on **every** line, including ones written deep inside a service
> and by the error handler, and those call sites should not have to remember. `x-request-id` is
> adopted only if it is printable ASCII and ≤128 characters, otherwise a UUID is minted; the id is
> echoed in the response header, added to every log line by `writeLog`, and written into audit
> `metadata` via `auditRpcArguments()`.
>
> The client address is validated with `net.isIP` before it is used, so a forged `X-Forwarded-For`
> becomes `null` rather than an uncastable `inet` value — an `inet` cast failure inside a money RPC
> would roll back a real sale on the strength of a request header. `20260921000400_audit_log_request_id.sql`
> adds `p_request_id text default null` to `write_audit_log`, merged into `metadata` only when non-blank.

**2.3 — Add server timeouts (R9). Medium.**
`server.requestTimeout = 30_000`, `headersTimeout = 35_000`, `keepAliveTimeout = 65_000` in
`server.ts`. **The SSE stream must be exempted** — call `request.setTimeout(0)` after `flushHeaders()`
in `events.routes.ts`, or the 30s timeout kills realtime for everyone. Verify with `curl -N` holding
the stream open past 30s. **The exemption ships in the same change.**

> **Correction, 2026-09-21 — measured, and two claims above are wrong.** Shipped in `3028781`.
>
> - **30 s is too aggressive; 120 s shipped.** `requestTimeout` bounds how long the server will wait
>   to **receive** a request, not how long a handler may take. An 8 MB base64 image upload over a slow
>   shop uplink exceeds 30 s, so the recommended value would have broken image uploads and presented
>   as anything but a timeout. Shipped: `REQUEST_TIMEOUT_MS = 120_000`, `HEADERS_TIMEOUT_MS =
>   35_000`, `KEEP_ALIVE_TIMEOUT_MS = 65_000`.
> - **The exemption is not what keeps realtime alive.** Against a real server, an event stream held
>   open for 75 s stayed alive **with and without** `request.setTimeout(0)` — 37 heartbeats either
>   way — because by then the request had been fully received. `request.setTimeout` clears a *socket
>   idle* timer; `requestTimeout` governs *receiving*. **They are not connected.** The exemption still
>   ships, but as a guard, and both the code comment and the commit message say so instead of the
>   reassuring version.
> - **`requestTimeout` is armed and effective** — a positive control (a stalled POST body) was closed
>   at ~60 s with `408`. It is enforced by Node's `connectionsCheckingInterval`, which ticks every
>   30 s, so a timeout is observed at the first tick *after* the deadline, not at the deadline. That
>   is the likely source of the "30 s" reading.
>
> **Proof:** `~/.workbuddy-ai/skills/printsync-http-runtime-verification/scripts/verify-sse-timeouts.mjs`
> — the positive control plus both stream arms.

**2.4 — Add a global rate limit (R10). Medium.**
A limiter on `/api/v1` with a generous ceiling, skipping `/api/v1/events`. Keep the existing
login/refresh limiters. **Ordering: after 1.2**, or every client shares the proxy's bucket.

> **As shipped, 2026-09-21 (`da45b30`).** Ceiling **1,500 requests / minute per client**
> (`backend/src/middleware/apiRateLimit.ts`), derived rather than guessed: the degraded revalidation
> poll is 60 s across five domains (`orders`, `inventory`, `customers`, `designs`, `users`), so eight
> pessimistic workstations are ≈480/min. The ceiling is ~3× headroom and exists to **end a runaway,
> not to shape normal use** — a limit tight enough to notice in normal work would be the wrong limit.
> `/api/v1/health`, `/api/v1/ready` and `/api/v1/events` are skipped, matched on a **path boundary**
> so a future `/api/v1/events-export` cannot be silently exempted by a bare `startsWith`. The bucket
> is the **shop, not the workstation**, because Cloudflare/Render and every workstation share one
> public IP — which is exactly why this had to land after 1.2.

### Tier 3 — Maintainability

**3.1 — Decompose `POSPage.tsx` (R11). Medium. Behaviour-preserving only.**
Extract, one commit at a time: `hooks/usePOSCart.ts`, `usePOSTransactions.ts`, `usePOSHistory.ts`,
`useOrderEditHydration.ts`, `usePOSKeyboardShortcuts.ts`, `usePOSCheckout.ts`, `usePOSReceipts.ts`, and
`components/pos/POSToolbar.tsx`; plus a new `app/stores/usePaymentStore.ts` wrapping `paymentsApi`
(registered in `app/stores/index.ts`, with a real `payments` revalidator replacing the current no-op).
**Must stay in the page:** the idempotency-key lifetime semantics, the `editingOrderVersion` captured
at hydration, freezing the cart before send, and the reconcile-only-on-non-4xx ordering. **Verify:** the
five existing money tests stay green, plus a characterisation test per hook written *before* the move,
plus a before/after screenshot of `/pos`. **Do this last**, after 1.5's guard and 3.2's CI gate exist.

**3.2 — Wire the flat-UI gate into CI; scope E2E (R12). Medium.**
Add `npm run check:flat-ui` to the frontend job in `.github/workflows/ci.yml` — it passes today, so it
is free to add. For E2E: recommended **not** as a blocking gate yet, since CI deliberately withholds
live credentials. Add a separate non-blocking workflow covering login → POS sale (including an
idempotent retry) → receipt, and an order-edit conflict across two sessions. **Ordering: before 3.1.**

**3.3 — One analytics implementation (R13). Low-Med.**
Delete the fallback at `analytics.service.ts:123-199`; on RPC failure throw
`503 ANALYTICS_LOOKUP_FAILED`. A money figure should error rather than quietly come from a different
code path. Verify with a test stubbing the RPC to fail, and by comparing numbers over a range before
and after. **Ordering: after confirming the repaired RPC is live.**

**3.4 — `playwright` → `devDependencies` (R15). Low.** `frontend/package.json:21`. Verify with
`npm ls playwright --omit=dev` → empty, and a clean build.

**3.5 — Drop the duplicate `sales_transaction_items` index (R15). Low.** NEW migration dropping
`sales_transaction_items_transaction_created_idx`; keep the other. Verify via `pg_indexes`.

**3.6 — Index the foreign keys (R15). Low.** NEW migration adding `if not exists` indexes for the
twelve unindexed FKs. Verify by querying `pg_constraint` for FK columns whose leading column is not
indexed → empty.

**3.7 — Decide on `purchase_orders` and the dead exports (R15). Low.** Either drop the table (and edit
`seedDemoData.ts:46,53,452`) or mark it reserved with a `comment on table` and remove it from the
seeder. Also remove the four dead exports and the two dead UI props/variants. Last.

### Ordered summary

| # | Item | Severity | Blocks |
| --- | --- | --- | --- |
| 0.1 | Duplicate `orders_customer_idx` | Blocker | every new environment |
| 0.2 | Stale RPC overloads | High | safe future callers |
| 1.1 | Shop-local dates | High | correct daily figures |
| 1.2 | `trust proxy` | High | audit IP + rate limiting |
| 1.3 | `order_payments.delete` | High | who can erase money |
| 1.4 | `users.read` gating | Med-High | read/manage consistency |
| 1.5 | Contract repair + drift guard | Medium | lost-update protection |
| 2.1 | Audit atomicity | Medium | audit completeness |
| 2.2 | Request IDs | Low-Med | traceability |
| 2.3 | Server timeouts + SSE exemption | Medium | slow-client resistance |
| 2.4 | Global rate limit | Medium | abuse resistance |
| 3.1 | POS decomposition | Medium | maintainability |
| 3.2 | CI gate + E2E scope | Medium | UI regression gate |
| 3.3 | Single analytics path | Low-Med | number correctness |
| 3.4–3.7 | Dependency, index and dead-code hygiene | Low | clarity |

---

## 5. Suggested commit boundaries

Each of these is independently reviewable and revertible:

1. `fix(db): give the duplicated orders_customer_idx a unique name` (0.1)
2. `fix(db): drop superseded order RPC overloads` (0.2)
3. `fix(dates): derive calendar dates in the shop time zone` (1.1)
4. `fix(api): trust the Render proxy for client IPs` (1.2)
5. `feat(authz): add order_payments.delete capability` (1.3)
6. `fix(authz): enforce users.read on the users router` (1.4)
7. `fix(types): restore updatedAt to the Order contract + drift guard` (1.5)
8. `feat(obs): request ids` (2.2) → `fix(audit): atomic audit writes` (2.1)
9. `fix(server): request/header timeouts with an SSE exemption` (2.3) → `feat(api): global rate limit` (2.4)
10. `ci: run the flat-ui gate` (3.2) → `refactor(pos): extract hooks and a payment store` (3.1)
11. Hygiene batch (3.3–3.7)

---

## 6. What was not verified

Stated plainly so nobody treats an inference as a measurement:

- **The live database's actual index and overload state.** The migration files contradict what the
  running system implies. Only `pg_indexes` / `pg_proc` queries against the live project settle it.
  Fix 0.1 is written to converge from either state. **Partially closed 2026-09-22:** the *column*
  half is now settled (`orders.customer_id` and `orders.due_date` are both present on live), but the
  index names and the dropped overloads still need a SQL session.
- **The `main` branch protection ruleset.** Not stored in the repository and `gh` is not installed.
  Only the CI job names could be confirmed as consistent with the convention.
- **Runtime behaviour of `express-rate-limit` without `trust proxy`** — the setting is confirmed
  absent; whether it throws or merely warns was not executed.
- **`backend/dist` and `packages/shared-types/dist`** were excluded, so built output was not compared
  against source.
- **Nothing was run.** No server was started, no test suite executed, no database queried. Every
  finding is a static read of the working tree. The verification steps in §4 are designed to convert
  each finding into a measurement.
- **Branch note:** this review covers the `flat-ui` working tree. `main` is behind it (`main` at
  `ccbe44a3`, `flat-ui` at `556d98a`) and still carries `motion@12`, so R11–R12 and the flat-UI items
  describe `flat-ui`, not `main`.
- **Amended 2026-09-21.** The fixes that followed this review **were** run: migrations replayed
  against embedded PostgreSQL, the money RPCs forced to fail to prove rollback, the production server
  started and probed, and the build exercised. Two of this review's own claims did not survive that
  measurement — 2.3's timeout value and its SSE premise — and both are corrected inline in §4. The
  bullets above describe the review **as it was performed**, before any of that.
