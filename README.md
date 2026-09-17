<div align="center">

# PRINTSYNC

**ERP and point-of-sale platform for custom printing businesses.**

Inventory · Orders · Production Tracking · Point of Sale · Analytics · Audit

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3FCF8E?logo=supabase&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-5-6E9F18?logo=vitest&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

</div>

---

## Overview

PRINTSYNC is a full-stack enterprise resource planning (ERP) application built for
made-to-order printing businesses — the kind that juggle custom designs, stock
consumables, walk-in sales, and production deadlines at the same time.

It replaces scattered spreadsheets and paper job tickets with a single system:
staff can ring up a sale at the counter, track a custom order through its
production lifecycle, watch stock levels adjust automatically, and let the owner
read profitability and demand trends off a live analytics dashboard. Every
privileged action is written to an append-only audit log.

The system is **live everywhere at once**. A change made at one workstation —
a new inventory item, a stock movement, a new order — reaches every other open
screen in about a second over a server-pushed event stream, with no page reload.
A connection indicator in the header tells staff whether what they are looking at
is current, and the system says so explicitly when an action fails rather than
failing silently.

The default installation is branded for **IC Printing Services**, but the
business name and logo are configurable from **Settings** at runtime.

---

## Features

| Area | What it does |
| --- | --- |
| **Dashboard** | At-a-glance KPIs, recent activity, and low-stock signals on landing. |
| **Live updates** | Any change — inventory, orders, customers, designs, payments, settings — is pushed to every open screen in under a second. No reload, no polling wait. A connection chip reports the state of the stream and shows a "Syncing" state while a refresh is in flight. |
| **Orders** | Create custom or catalogue orders with line items, attach designs, set due dates, and move them through the production lifecycle. Phase changes apply instantly and roll back with a reason if the server refuses. |
| **Production lifecycle** | Orders track one of six statuses — `Pending`, `In Production`, `Designing`, `Ready for Pickup`, `Delivered`, `Completed` — rendered as a phase progress bar (`workPhases` in `PhaseProgress.tsx`). Partial payments are supported per order via `totalPaid` / `balanceDue`. |
| **Point of Sale** | Walk-in checkout with a product catalogue, design picker, live cart totals, discount and VAT handling, payment method selection (Cash / Card / Custom Order), receipt modal, and transaction history with void support. Every checkout carries an idempotency key, so a retry after a lost response cannot charge twice; an ambiguous failure is looked up and reported as committed / not committed / unknown. |
| **Inventory** | Items with stock levels, costs, and reorder thresholds. Stock movements are recorded explicitly rather than silently overwritten, and a checkout that would oversell names the item and how many are left. |
| **Design repository** | Store and reuse customer artwork; assets are uploaded to Supabase Storage and linked to orders and POS line items. Reached from within Orders and POS rather than from its own screen. |
| **Customers** | Customer records with contact details and order history, selectable during order and POS creation. Deleting a customer who has order history warns first and reports how many orders are affected. |
| **Analytics** | Server-computed metrics: summary KPIs, sales timeline, product trends, and inventory forecasting. |
| **Users & roles** | Admin-managed user accounts with role-based access (`admin`, `staff`). |
| **Audit log** | Append-only record of authentication events, user management, and order changes — admin-readable only. |
| **Settings** | Business branding, logo upload, VAT rate, and currency configuration. |
| **Export** | CSV export of orders, inventory, and transactions. |

> **Backend-only modules.** `suppliers` and `expenses` are fully implemented in the
> API and database, but do not yet have dedicated screens in the UI.

---

## Architecture

```
┌──────────────────────────┐        ┌──────────────────────────┐        ┌────────────────────┐
│   Frontend (React SPA)   │        │   Backend (Express 5)    │        │      Supabase      │
│                          │        │                          │        │                    │
│  Vite + React 19 + TW4   │  JSON  │  routes/  → modules/     │  SDK   │  Postgres + RLS    │
│  feature-sliced folders  │ ─────▶ │  services/ (auth, audit) │ ─────▶ │  Auth              │
│  session via HttpOnly    │ ◀───── │  zod validation          │        │  Storage (designs) │
│  cookies (credentials)   │  SSE   │  helmet, cors, rate-limit│        │  RPCs (atomic      │
│  domain-event cache      │ ◀═════ │  domainEventBus          │        │   money + stock)   │
└──────────────────────────┘        └──────────────────────────┘        └────────────────────┘
        :3000                        :4000  /api/v1 + /events                 managed
```

- **Frontend** is a Vite-built single-page app. It never talks to Supabase directly —
  all data access goes through the backend using `VITE_API_BASE_URL`.
- **Backend** is layered: `routes/` declare HTTP + validation, `modules/*/` hold
  business logic and database access, `services/` handle cross-cutting concerns
  (authentication context, audit logging, the domain event bus). Shared types live in
  `packages/shared-types`.
- **Supabase** is the only persistence layer. Row Level Security protects browser
  clients; the backend uses the service-role key server-side and never exposes it
  to the frontend. Multi-table writes that must not half-apply — a sale and its stock
  movements, an order and its line items — happen inside Postgres RPCs under row
  locks rather than across several API calls.

### Keeping every screen current

Two mechanisms, deliberately separate:

- **Freshness.** `shared/store/dataEvents.ts` is a pub/sub bus for "domain X
  changed". `createListStore` tracks when each collection was last fetched and
  exposes `isStale()` / `revalidate()` / `forceRevalidate()`. A real mutation or a
  server push is authoritative and calls `forceRevalidate()`; time-based triggers
  (focus, visibility, reconnect, a 60-second safety-net poll) call `revalidate()`,
  which respects a 15-second freshness window so a background refresh cannot thrash.
- **Transport.** `GET /api/v1/events` is a Server-Sent Events stream. The API
  publishes a `data-change` frame after a write commits, filtered per domain by the
  session's own capabilities, so a staff workstation is never prompted to refetch a
  screen it cannot read. A named `heartbeat` frame every 25 seconds lets the client
  detect a half-open connection.

SSE was chosen over WebSockets because the traffic is one-directional, it reconnects
on its own, and it rides on plain HTTP so the existing `HttpOnly` cookie session
authenticates it with no new mechanism. Supabase Realtime was rejected on purpose:
it would mean shipping an anon key to the browser and making RLS the security
boundary, which contradicts the decision above.

> **Single-instance caveat.** The event bus is in-process, so a change handled by
> API instance A does not reach a browser connected to instance B. That is correct
> for one shop on one server. Scaling the API horizontally requires moving the bus to
> Postgres `LISTEN`/`NOTIFY`; the call sites will not need to change.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| UI | React 19, React Router 7, Tailwind CSS 4, Recharts, Lucide icons, Motion |
| State | Zustand stores over a shared `createListStore` factory (freshness + optimistic overlay) |
| Build | Vite 6, TypeScript 5.8 (strict) |
| API | Express 5, TypeScript (ESM, `NodeNext`), Zod 4, Helmet, CORS, express-rate-limit |
| Realtime | Server-Sent Events (`GET /api/v1/events`) over the existing cookie session |
| Data | Supabase (Postgres + Auth + Storage), `@supabase/supabase-js` |
| Auth | Supabase Auth, session tokens in `HttpOnly` cookies with refresh rotation |
| Shared | `packages/shared-types` — compiled TypeScript contracts |
| Tests | Vitest 5 + Testing Library + jsdom (frontend); Node's built-in runner via `tsx --test` (backend unit + integration) |
| CI | GitHub Actions — type-check, unit tests and build for all three workspaces |

---

## Repository structure

```
PRINTSYNC/
├── backend/                    # Express 5 REST API
│   ├── src/
│   │   ├── app.ts              # createApp(): middleware + route mounting
│   │   ├── server.ts           # Local entry point (app.listen)
│   │   ├── config/env.ts       # Zod-validated environment
│   │   ├── routes/             # HTTP layer, one file per resource (+ events, branding)
│   │   ├── modules/            # Business logic per domain
│   │   ├── services/           # authService, auditLogService, asset services,
│   │   │                       # domainEventBus, dataChangePermissions
│   │   ├── middleware/         # authenticate, authorize, errorHandler, notFound
│   │   ├── integrations/       # Supabase clients
│   │   ├── shared/             # apiResponse, errors, authCookies, pagination, csv, logger
│   │   ├── types/              # auth context + Express request augmentation
│   │   └── scripts/            # provisionUser.ts — create/repair app users
│   └── tests/
│       ├── unit/               # Fast, dependency-free (fakes for Supabase/Auth)
│       └── integration/        # Drives the real API against a disposable project
│
├── frontend/                   # React 19 SPA
│   └── src/
│       ├── app/                # Router, layout, providers, stores, hooks
│       │                       # (useDataRevalidation, useRealtimeStatus, useIsSyncing)
│       ├── features/           # auth, orders (POS + orders), inventory, customers,
│       │                       # designs, analytics, users, audit, settings, dashboard
│       ├── shared/             # api client + errors, UI kit, constants, hooks,
│       │                       # store (createListStore, dataEvents), realtime (eventStream)
│       └── test/               # Vitest setup + shared fixtures
│
├── packages/shared-types/      # @printsync/shared-types
│   └── src/                    # Contracts, incl. dataEvent.ts (realtime vocabulary)
│
├── supabase/
│   └── migrations/             # Timestamped SQL migrations
│
├── Dockerfile                  # Builds all three workspaces, ships the API runtime
├── .dockerignore               # Keeps .env files and node_modules out of the image
├── render.yaml                 # Render Blueprint: one Docker web service
│
└── .github/workflows/ci.yml    # Type-check + test + build, all three workspaces
```

---

## Getting started

### Prerequisites

- **Node.js** 20 LTS or newer (developed against Node 22 LTS) and npm
- A **Supabase** project (free tier is sufficient)
- **Supabase CLI**, if you want to push migrations from your machine
  (`scoop install supabase` / `brew install supabase/tap/supabase`)

### 1. Install dependencies

PRINTSYNC has three workspaces. Install each one:

```bash
git clone https://github.com/RoiRendal/PRINTSYNC.git
cd PRINTSYNC

cd packages/shared-types && npm install && cd ../..
cd backend  && npm install && cd ..
cd frontend && npm install && cd ..
```

### 2. Configure environment variables

```bash
cp backend/.env.example  backend/.env
cp frontend/.env.example frontend/.env
```

Then fill in the values (see [Environment variables](#environment-variables)).

### 3. Set up the database

```bash
cd supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
cd ..
```

Alternatively, paste the contents of `supabase/migrations/*.sql` into the
Supabase SQL editor in migration order — they are numbered sequentially.

### 4. Provision the first admin user

From the `backend` directory:

```bash
# PowerShell
$env:PROVISION_EMAIL    = 'admin@printsync.com'
$env:PROVISION_PASSWORD = '<a-password-of-at-least-8-characters>'
$env:PROVISION_NAME     = 'System Administrator'
$env:PROVISION_PHONE    = '09171234567'
$env:PROVISION_POSITION = 'System Administrator'
$env:PROVISION_ROLE     = 'admin'
npm run provision:user
```

```bash
# macOS / Linux
PROVISION_EMAIL=admin@printsync.com \
PROVISION_PASSWORD='<a-password-of-at-least-8-characters>' \
PROVISION_NAME='System Administrator' \
PROVISION_PHONE=09171234567 \
PROVISION_POSITION='System Administrator' \
PROVISION_ROLE=admin \
npm run provision:user
```

Re-run with `PROVISION_ROLE=staff` for staff accounts. Existing accounts keep
their password unless you explicitly set `PROVISION_RESET_PASSWORD=true`.
Clear the variables from your shell when you are done.

### 5. Run the app

```bash
# Terminal 1 — API on http://localhost:4000
cd backend && npm run dev

# Terminal 2 — SPA on http://localhost:3000
cd frontend && npm run dev
```

Open <http://localhost:3000> and sign in with the provisioned admin account.

The header's connection chip should settle on **Live** within a second or two of
signing in. If it does not, the event stream is not reaching the browser — see
[Live updates](#live-updates-get-events).

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `NODE_ENV` | No | `development` | `development` \| `test` \| `production`. Controls cookie `secure` flag. |
| `PORT` | No | `4000` | HTTP port. |
| `FRONTEND_ORIGIN` | Yes | `http://localhost:3000` | Allowed CORS origin. **Must** be set to the frontend URL in production. |
| `SUPABASE_URL` | Yes | — | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | — | Service-role key. Server-side only — never expose to the browser. |
| `LOG_LEVEL` | No | `info` | `debug` \| `info` \| `warn` \| `error`. Use `debug` to see SSE connect/disconnect lines. |
| `FRONTEND_DIST` | No | auto-detected | Absolute path to the built SPA when the API serves it. Only needed if the build sits somewhere unusual. |

The config is validated by Zod at boot; an invalid value stops the process with a
field-level error report.

### Frontend (`frontend/.env`)

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | No | `/api/v1` | Base URL of the REST API. Set to the full backend URL when frontend and backend are hosted separately. |

---

## Scripts

### Backend

| Command | Description |
| --- | --- |
| `npm run dev` | Start the API with `tsx watch` (hot reload) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled server (`node dist/server.js`) |
| `npm run lint` | Type-check without emitting (`tsc --noEmit`) |
| `npm run lint:tests` | Type-check the test suite separately |
| `npm run test:unit` | Fast unit tests — no network, no credentials |
| `npm run test:integration` | Integration tests against the running API |
| `npm test` | Both suites, unit first |
| `npm run provision:user` | Create or repair an application user |

### Frontend

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server on port 3000 (proxies `/api` → `127.0.0.1:4000`) |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run clean` | Remove `dist/` |
| `npm run lint` | Type-check without emitting |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |

### Shared types

| Command | Description |
| --- | --- |
| `npm run build` | Compile contracts into `dist/` |
| `npm run lint` | Type-check without emitting |

---

## API reference

All routes are mounted under `/api/v1` and require an authenticated session
unless noted. Every response is wrapped in `{ "data": ... }`; errors use
`{ "error": { "code": ..., "message": ..., "details": ... } }` — `details` carries
structured context, such as which inventory item ran short and how many are left.

| Group | Endpoints |
| --- | --- |
| **Health** | `GET /health`, `GET /ready` — public, no auth |
| **Branding** | `GET /branding` — public, no auth; the login screen's name and logo |
| **Auth** | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/session` |
| **Events** | `GET /events` — Server-Sent Events stream (see below) |
| **Orders** | `GET /orders`, `GET /orders/:id`, `POST /orders`, `PATCH /orders/:id`, `DELETE /orders/:id` |
| **Payments** | `GET /payments/transactions`, `GET /payments/transactions/:id`, `GET /payments/transactions/by-key/:key`, `POST /payments/transactions`, `POST /payments/transactions/:id/void` |
| **Order payments** | `GET /order-payments/:orderId`, `POST /order-payments`, `DELETE /order-payments/:id` (partial payments against an order) |
| **Inventory** | `GET /inventory`, `POST /inventory`, `PATCH /inventory/:id`, `DELETE /inventory/:id`, `POST /inventory/:id/movements` |
| **Designs** | `GET /designs`, `POST /designs`, `PATCH /designs/:id`, `DELETE /designs/:id`, `POST /designs/assets` |
| **Customers** | `GET /customers`, `GET /customers/:id`, `GET /customers/:id/order-count`, `POST /customers`, `PATCH /customers/:id`, `DELETE /customers/:id` |
| **Suppliers** | `GET /suppliers`, `GET /suppliers/:id`, `POST /suppliers`, `PATCH /suppliers/:id`, `DELETE /suppliers/:id` |
| **Expenses** | `GET /expenses`, `POST /expenses`, `PATCH /expenses/:id`, `DELETE /expenses/:id` |
| **Analytics** | `GET /analytics/summary`, `GET /analytics/sales-timeline`, `GET /analytics/product-trends`, `GET /analytics/inventory-forecast` |
| **Users** | `GET /users`, `POST /users`, `PATCH /users/:id`, `DELETE /users/:id` (`users.manage`) |
| **Audit** | `GET /audit-logs` (`audit.read`) |
| **Settings** | `GET /settings`, `PATCH /settings`, `POST /settings/logo`, `DELETE /settings/logo` |
| **Export** | `GET /export/orders`, `GET /export/inventory`, `GET /export/transactions` (CSV) |

### Live updates (`GET /events`)

A Server-Sent Events stream, authenticated by the same session cookie as every
other route. It is gated by `authenticate` **only** — there is no single capability
that describes "may watch for changes", so the filter is applied per event instead:
each connection receives only the domains its own permissions allow.

```
event: connected
data: {"domains":["orders","inventory","customers","designs","payments","settings"],"at":"..."}

event: data-change
data: {"domains":["inventory"],"at":"..."}

event: heartbeat
data: {"at":"..."}
```

| Frame | Meaning |
| --- | --- |
| `connected` | Sent immediately. Lists the domains this session will actually receive, so the UI can tell "connected" from "connected but nothing to watch". |
| `data-change` | A write committed. The client marks those domains stale and refetches the ones it has loaded. |
| `heartbeat` | Every 25 seconds. Named deliberately — `EventSource` never surfaces a `: ping` comment to script, so a comment-only keep-alive is invisible to the client's silence watchdog and a healthy stream gets redialled forever. |

`GET /payments/transactions/by-key/:key` is the checkout reconciliation lookup: it
returns the sale committed under an idempotency key, or `200` with `data: null`.
It is deliberately **not** a `404` — "no sale under this key" is the ordinary answer,
and making the client parse an error envelope to learn it would be the wrong shape.

### Authentication flow

1. `POST /auth/login` validates credentials against Supabase Auth.
2. On success the API sets `printsync_access_token` (1 hour) and
   `printsync_refresh_token` (30 days) as `HttpOnly`, `SameSite=Lax` cookies —
   `secure` in production.
3. The SPA always sends `credentials: 'include'`. On a `401`, the API client
   transparently attempts `POST /auth/refresh` and replays the original request
   once before surfacing the error.
4. `GET /auth/session` restores the session on page load.

Login is rate-limited to **10 attempts / 15 minutes per IP**; refresh to
**20 / 15 minutes**.

---

## Roles and permissions

| | Admin | Staff |
| --- | --- | --- |
| Dashboard | ✅ | — |
| Orders | ✅ | ✅ |
| Point of Sale | ✅ | ✅ |
| Inventory | ✅ | ✅ |
| Customers | ✅ | ✅ |
| Designs | ✅ | ✅ |
| Analytics | ✅ | — |
| Suppliers | ✅ | — |
| Expenses | ✅ | — |
| Users | ✅ | — |
| Audit log | ✅ | — |
| Settings | ✅ | — |

Navigation is filtered client-side via `NAV_ITEMS` + per-role access lists, and
routing is guarded by `RequireAuth` / `RequirePageAccess`. **The authoritative
check is server-side**: every route declares the capability it needs, for example
`requirePermission('orders.create')`.

The canonical capability catalogue is seeded in `supabase/migrations`:

| Domain | Capabilities |
| --- | --- |
| Dashboard | `dashboard.read` |
| Point of sale | `pos.read` |
| Orders | `orders.read`, `orders.create`, `orders.update`, `orders.delete` |
| Order payments | `order_payments.read`, `order_payments.create` |
| Transactions | `payments.read`, `payments.create`, `payments.void` |
| Inventory | `inventory.read`, `inventory.manage` |
| Designs | `designs.read`, `designs.manage` |
| Customers | `customers.read`, `customers.manage` |
| Suppliers | `suppliers.read`, `suppliers.manage` |
| Expenses | `expenses.read`, `expenses.manage` |
| Analytics | `analytics.read` |
| Audit | `audit.read` |
| Settings | `settings.read`, `settings.manage` |
| Users | `users.read`, `users.manage` |

**Admin** is granted every capability. **Staff** receives the operational subset:
`orders.read`, `orders.create`, `orders.update`, `pos.read`, `inventory.read`,
`designs.read`, `customers.read`, `payments.read`, `payments.create`,
`order_payments.read`, `order_payments.create`, and `settings.read`.

Note that `order_payments.*` uses an underscore while every other capability uses
a dot — this is intentional and matches the seeded keys.

Two entries in the catalogue are currently **labels only**, with no route enforcing
them: `dashboard.read` and `pos.read`. Both pages are gated client-side by
`ADMIN_PAGE_ACCESS` / `STAFF_PAGE_ACCESS`, and the data behind them is protected by
the capabilities on the underlying routes — a POS screen is only useful to a session
holding `inventory.read`, `payments.create` and `customers.read`. They are retained
because they describe a real page and are used to group capabilities in the admin UI,
but revoking `pos.read` alone does not block the POS. `users.read` is in the same
position: `usersRouter` is gated end-to-end by `users.manage`, so `users.read` is
currently granted to admin only and enforced nowhere.

---

## Data model

The schema is built by 27 ordered migrations in `supabase/migrations/`:

| Concern | Migrations |
| --- | --- |
| Identity & authorization (`profiles`, `roles`, `permissions`, `role_permissions`, RLS) | `…000100_identity_authorization` |
| Audit logging (append-only `audit_logs`, `pos.read`, RLS, `SECURITY DEFINER` writer) | `…000200` – `…000600` |
| Core operations (inventory, designs, design asset storage, orders, payments, settings) | `…000700` – `…001200` |
| Transactional lifecycle & analytics (indexes, summary RPC) | `…001300` – `…001500` |
| Business extensions (customers, order payments, inventory cost, suppliers, expenses, due dates, VAT/currency) | `…001600` – `…002200` |
| Permissions & order update RPC | `…002300` – `…002400` |
| Storage bucket for uploaded assets | `…15000000_storage_bucket` |
| Idempotent sales, structured stock errors, optimistic order updates | `…16000000`, `…16000001` |

**Key design decisions**

- `audit_logs` is append-only and written through a narrowly scoped
  `SECURITY DEFINER` function, so the backend never needs direct write
  privileges on the table.
- Passwords, access tokens, and refresh tokens are never persisted by the app.
- Row Level Security is enforced for any browser client; the backend bypasses it
  deliberately using the service-role key for provisioning and privileged writes.
- Inventory changes are recorded as **movements**, preserving an audit trail of
  stock changes rather than mutating a single quantity column.
- **Money-moving writes are atomic in the database, not the API.** A sale and its
  stock movements happen inside one `SECURITY DEFINER` RPC holding row locks, which
  rejects an oversell explicitly and returns structured detail naming the item.
- **Every checkout carries an idempotency key** (`sales_transactions.idempotency_key`,
  partial unique index). The RPC's replay guard runs *before* validation, so a retry
  of an attempt that already committed replays rather than charging again.
- **Order edits are compare-and-swap on `updated_at`.** A save carries the version
  it was based on; a stale one is refused with `409 ORDER_CONFLICT` instead of
  silently overwriting another staff member's work.

---

## Testing

```bash
# Backend unit tests — fast, no network, no credentials required
cd backend && npm run test:unit

# Backend integration tests — drives the real API
cd backend && cp .env.example .env   # point at a disposable Supabase project
npm run test:integration

# Frontend
cd frontend && npm test
```

The suites are aimed at the failures that are **silent** rather than loud — the ones
where nothing visibly breaks and the damage is discovered later:

| Suite | Covers |
| --- | --- |
| `backend/tests/unit` | The domain event bus and its permission filter (the push channel's security boundary), the sale and stock RPC wrappers, structured checkout errors, pagination, CSV, and the user/customer failure messages. Supabase and Supabase Auth are faked, so no credentials are needed. |
| `backend/tests/integration` | Auth, orders, inventory, payments and branding end to end against a real project. |
| `frontend/src/**/*.test.{ts,tsx}` | The store freshness rules (`revalidate()` vs `forceRevalidate()`, and that an ordinary refetch cannot overwrite a pending optimistic write), the realtime client including a regression guard for the heartbeat defect, the idempotency-key lifetime that decides whether a retry double-charges, the structured-error reader, and the checkout dialog itself. |

Type-checking both workspaces before committing is recommended:

```bash
cd backend  && npm run lint && npm run lint:tests
cd frontend && npm run lint
```

**CI** (`.github/workflows/ci.yml`) runs on every push and pull request and gates
type-check, unit tests and build for all three workspaces. `test:integration` is
deliberately excluded — it needs live credentials, which must not be handed to CI.
The frontend type-check is the gate that matters most: Vite transpiles without
checking types, so a build can succeed with type errors in it.

---

## Deployment

**Nothing is deployed yet.** The configuration to do it is in the repository:
`Dockerfile`, `.dockerignore`, and `render.yaml` (a Render Blueprint that provisions a
single Docker web service). The backend is a long-lived HTTP server — `src/server.ts`
calls `app.listen()` — so it needs a container or server runtime rather than a
function-based platform.

### One address, not two

The API serves the built SPA from the same origin. That removes the CORS question
entirely, and — more importantly — keeps the session cookie on a single site.

**Why that matters.** The session cookie is `SameSite=Lax`, and `Lax` cookies are not
sent across sites. Same-site is decided by the **public suffix list**, and
`vercel.app`, `onrender.com`, `netlify.app`, `fly.dev`, `up.railway.app` and
`herokuapp.com` are all on it — so every subdomain of those is its own site. Deploying
the SPA to `printsync.onrender.com` and the API to `printsync-api.onrender.com` looks
correct and is not: login appears to succeed and then behaves as if signed out, and
the live-update stream fails too. Two services on one **custom** domain
(`app.example.com` + `api.example.com`) is fine — there the registrable domain is
shared. Anything else needs `SameSite=None; Secure`, which affects both the API and
the event stream.

### Deploying on Render

1. Push `main` — the branch `render.yaml` names — then in the Render dashboard
   choose **New → Blueprint** and connect the repository.
2. Supply the three values marked `sync: false`: `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, and `FRONTEND_ORIGIN`.
3. **Get the address first, then set `FRONTEND_ORIGIN`.** If the service name is
   taken Render appends characters, so confirm the assigned URL on the service page
   and match it exactly — `https://`, no trailing slash. Getting it wrong means every
   request is refused by the browser.
4. Wait for the first build. It installs three workspaces and runs three builds, so it
   takes a few minutes; later deploys are faster.

The free plan sleeps after ~15 minutes idle, so the next visit takes 30–60 seconds to
wake. That is the plan, not the application.

### What the deployment configuration handles

1. **Workspace build order.** The backend reads `@printsync/shared-types` from its
   *compiled* output, so the contracts build first. `Dockerfile` orders them
   `shared-types` → `frontend` → `backend`.
2. **No `.env` in the image.** `.dockerignore` excludes `backend/.env` — the
   service-role key — and `frontend/.env`, which points at `http://localhost:4000` and
   would otherwise be baked into the shipped bundle. `VITE_API_BASE_URL` is read at
   **build** time, so the image sets it explicitly.
3. **`NODE_ENV=production`** — set in the image, so the session cookie gets its
   `Secure` flag and the content-security policy drops `upgrade-insecure-requests`.
4. **Static serving with an SPA fallback.** `src/app.ts` serves `frontend/dist` when it
   exists, rewrites unknown non-`/api/` GETs to `index.html`, and caches hashed assets
   immutably while keeping `index.html` on `no-cache`.
5. **Images survive the content-security policy.** Helmet's default
   `img-src 'self' data:` would block every design asset and the business logo, since
   those are public URLs on the Supabase Storage host. The policy names that origin
   explicitly.
6. **Keep the API at one instance.** The event bus is in-process, so a second instance
   would serve changes it never hears about. Scale after moving the bus to Postgres
   `LISTEN`/`NOTIFY`, which needs a `DATABASE_URL` holding the *direct* connection
   string — the transaction pooler does not support `LISTEN`.
7. **Do not let a proxy buffer `GET /events`.** The route already sends
   `Cache-Control: no-cache, no-transform` and `X-Accel-Buffering: no`, but a proxy
   that ignores them will hold the stream and the UI will look frozen. The 25-second
   heartbeat is chosen to sit under nginx's 60-second default read timeout.

`docs/CREDENTIAL-ROTATION-AND-DEPLOYMENT.md` has the step-by-step procedure for
rotating the development passwords and moving the service-role key out of
`backend/.env` before the first real deployment.

A leftover `frontend/vercel.json` (SPA rewrite) and empty `.vercel/` directories
remain from an earlier experiment. They are unused and safe to delete.

---

## Security notes

- The service-role key lives **only** in `backend/.env`. Never add it to
  `frontend/.env` or any `VITE_`-prefixed variable — those are bundled into
  client JavaScript.
- Session cookies are `HttpOnly` and, in production, `Secure`.
- All request bodies are validated with Zod before reaching business logic.
- Login and refresh endpoints are rate-limited.
- Passwords and tokens are never written to the audit log.
- The realtime stream is filtered **per capability, never per role** — a role-based
  filter would drift out of step with the seeded grants, and drifting upward would
  leak admin-only activity to every workstation.
- A failed action distinguishes a **verdict** from an **outage**. A 4xx means the
  server validated and refused, so nothing was written; a dropped connection, a
  timeout or a 5xx does **not**, and is reported as unconfirmed rather than as a
  failure. That distinction is what stops a cashier retrying a sale that went through.
- Keep `.env` files, `supabase/.temp/`, and any database dumps out of version
  control. The provided `.gitignore` already covers these.
- **Before release:** rotate any development passwords and move
  `SUPABASE_SERVICE_ROLE_KEY` out of `backend/.env` into the host's secret store.
  `docs/CREDENTIAL-ROTATION-AND-DEPLOYMENT.md` is the step-by-step procedure, with a
  checklist that can be worked through without reading code.
- A container image is readable by anyone who can pull it, so `.dockerignore` must keep
  `.env` files out of the build context. `backend/.env` holds the service-role key.

---

## Contributing

1. Branch off `main`, and merge back into it once the change is verified.
2. Keep changes inside the relevant workspace (`frontend/`, `backend/`,
   `packages/shared-types/`). Shared contracts belong in `packages/shared-types`.
3. Run `npm run lint` in the workspaces you touched, and the tests:
   `npm run test:unit` in `backend/`, `npm test` in `frontend/`.
4. Add a migration under `supabase/migrations/` for any schema change — never
   edit an existing migration that has already been pushed.
5. Keep money and stock paths pessimistic. Optimistic UI is allowed for state that
   is cheap to get wrong and trivially corrected; it is not allowed anywhere a
   customer can be charged or stock can be misstated.

---

## License

Released under the **MIT License** — see [`LICENSE`](LICENSE).

Copyright (c) 2026 Roi Rendal.
