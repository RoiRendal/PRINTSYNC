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

The default installation is branded for **IC Printing Services**, but the
business name and logo are configurable from **Settings** at runtime.

---

## Features

| Area | What it does |
| --- | --- |
| **Dashboard** | At-a-glance KPIs, recent activity, and low-stock signals on landing. |
| **Orders** | Create custom or catalogue orders with line items, attach designs, set due dates, and move them through the production lifecycle. |
| **Production lifecycle** | Orders track one of six statuses — `Pending`, `In Production`, `Designing`, `Ready for Pickup`, `Delivered`, `Completed` — rendered as a phase progress bar (`workPhases` in `PhaseProgress.tsx`). Partial payments are supported per order via `totalPaid` / `balanceDue`. |
| **Point of Sale** | Walk-in checkout with a product catalogue, design picker, live cart totals, discount and VAT handling, payment method selection (Cash / Card / Custom Order), receipt modal, and transaction history with void support. |
| **Inventory** | Items with stock levels, costs, and reorder thresholds. Stock movements are recorded explicitly rather than silently overwritten. |
| **Design repository** | Store and reuse customer artwork; assets are uploaded to Supabase Storage and linked to orders and POS line items. |
| **Customers** | Customer records with contact details and order history, selectable during order and POS creation. |
| **Analytics** | Server-computed metrics: summary KPIs, sales timeline, product trends, and inventory forecasting. |
| **Users & roles** | Admin-managed user accounts with role-based access (`admin`, `staff`). |
| **Audit log** | Append-only record of authentication events, user management, and order changes — admin-readable only. |
| **Settings** | Business branding, VAT rate, and currency configuration. |
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
│  cookies (credentials)   │        │  helmet, cors, rate-limit│        │                    │
└──────────────────────────┘        └──────────────────────────┘        └────────────────────┘
        :3000                                :4000  /api/v1                   managed
```

- **Frontend** is a Vite-built single-page app. It never talks to Supabase directly —
  all data access goes through the backend using `VITE_API_BASE_URL`.
- **Backend** is layered: `routes/` declare HTTP + validation, `modules/*/` hold
  business logic and database access, `services/` handle cross-cutting concerns
  (authentication context, audit logging). Shared types live in
  `packages/shared-types`.
- **Supabase** is the only persistence layer. Row Level Security protects browser
  clients; the backend uses the service-role key server-side and never exposes it
  to the frontend.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| UI | React 19, React Router 7, Tailwind CSS 4, Recharts, Lucide icons, Motion |
| Build | Vite 6, TypeScript 5.8 (strict) |
| API | Express 5, TypeScript (ESM, `NodeNext`), Zod 4, Helmet, CORS, express-rate-limit |
| Data | Supabase (Postgres + Auth + Storage), `@supabase/supabase-js` |
| Auth | Supabase Auth, session tokens in `HttpOnly` cookies with refresh rotation |
| Shared | `packages/shared-types` — compiled TypeScript contracts |
| Tests | Node's built-in test runner via `tsx --test` (integration) |

---

## Repository structure

```
PRINTSYNC/
├── backend/                    # Express 5 REST API
│   ├── src/
│   │   ├── app.ts              # createApp(): middleware + route mounting
│   │   ├── server.ts           # Local entry point (app.listen)
│   │   ├── config/env.ts       # Zod-validated environment
│   │   ├── routes/             # HTTP layer, one file per resource
│   │   ├── modules/            # Business logic per domain
│   │   ├── services/           # authService, auditLogService, designAssetService
│   │   ├── middleware/         # authenticate, authorize, errorHandler, notFound
│   │   ├── integrations/       # Supabase clients
│   │   ├── shared/             # apiResponse, errors, authCookies, pagination, csv, logger
│   │   └── scripts/            # provisionUser.ts — create/repair app users
│   └── tests/integration/      # API integration tests
│
├── frontend/                   # React 19 SPA
│   └── src/
│       ├── app/                # Router, layout, providers
│       ├── features/           # auth, orders (POS + orders), inventory, customers,
│       │                       # designs, analytics, users, audit, settings, dashboard
│       └── shared/             # api client, UI kit, constants, hooks
│
├── packages/shared-types/      # @printsync/shared-types
│
└── supabase/
    └── migrations/             # Timestamped SQL migrations
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
| `LOG_LEVEL` | No | `info` | `debug` \| `info` \| `warn` \| `error`. |

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
| `npm run test:integration` | Run integration tests against the API |
| `npm run provision:user` | Create or repair an application user |

### Frontend

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server on port 3000 (proxies `/api` → `127.0.0.1:4000`) |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run clean` | Remove `dist/` |
| `npm run lint` | Type-check without emitting |

### Shared types

| Command | Description |
| --- | --- |
| `npm run build` | Compile contracts into `dist/` |
| `npm run lint` | Type-check without emitting |

---

## API reference

All routes are mounted under `/api/v1` and require an authenticated session
unless noted. Every response is wrapped in `{ "data": ... }`; errors use
`{ "error": { "code": ..., "message": ... } }`.

| Group | Endpoints |
| --- | --- |
| **Health** | `GET /health`, `GET /ready` — public, no auth |
| **Auth** | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/session` |
| **Orders** | `GET /orders`, `GET /orders/:id`, `POST /orders`, `PATCH /orders/:id`, `DELETE /orders/:id` |
| **Payments** | `GET /payments/transactions`, `GET /payments/transactions/:id`, `POST /payments/transactions`, `POST /payments/transactions/:id/void` |
| **Order payments** | `GET /order-payments/:orderId`, `POST /order-payments`, `DELETE /order-payments/:id` (partial payments against an order) |
| **Inventory** | `GET /inventory`, `POST /inventory`, `PATCH /inventory/:id`, `DELETE /inventory/:id`, `POST /inventory/:id/movements` |
| **Designs** | `GET /designs`, `POST /designs`, `PATCH /designs/:id`, `DELETE /designs/:id`, `POST /designs/assets` |
| **Customers** | `GET /customers`, `GET /customers/:id`, `POST /customers`, `PATCH /customers/:id`, `DELETE /customers/:id` |
| **Suppliers** | `GET /suppliers`, `GET /suppliers/:id`, `POST /suppliers`, `PATCH /suppliers/:id`, `DELETE /suppliers/:id` |
| **Expenses** | `GET /expenses`, `POST /expenses`, `PATCH /expenses/:id`, `DELETE /expenses/:id` |
| **Analytics** | `GET /analytics/summary`, `GET /analytics/sales-timeline`, `GET /analytics/product-trends`, `GET /analytics/inventory-forecast` |
| **Users** | `GET /users`, `POST /users`, `PATCH /users/:id`, `DELETE /users/:id` (`users.manage`) |
| **Audit** | `GET /audit-logs` (`audit.read`) |
| **Settings** | `GET /settings`, `PATCH /settings` |
| **Export** | `GET /export/orders`, `GET /export/inventory`, `GET /export/transactions` (CSV) |

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
| Analytics | ✅ | — |
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
`orders.read`, `orders.create`, `orders.update`, `inventory.read`, `designs.read`,
`customers.read`, `order_payments.read`, `order_payments.create`, and `pos.read`.

Note that `order_payments.*` uses an underscore while every other capability uses
a dot — this is intentional and matches the seeded keys.

---

## Data model

The schema is built by 24 ordered migrations in `supabase/migrations/`:

| Concern | Migrations |
| --- | --- |
| Identity & authorization (`profiles`, `roles`, `permissions`, `role_permissions`, RLS) | `…000100_identity_authorization` |
| Audit logging (append-only `audit_logs`, `pos.read`, RLS, `SECURITY DEFINER` writer) | `…000200` – `…000600` |
| Core operations (inventory, designs, design asset storage, orders, payments, settings) | `…000700` – `…001200` |
| Transactional lifecycle & analytics (indexes, summary RPC) | `…001300` – `…001500` |
| Business extensions (customers, order payments, inventory cost, suppliers, expenses, due dates, VAT/currency) | `…001600` – `…002200` |
| Permissions & order update RPC | `…002300` – `…002400` |

**Key design decisions**

- `audit_logs` is append-only and written through a narrowly scoped
  `SECURITY DEFINER` function, so the backend never needs direct write
  privileges on the table.
- Passwords, access tokens, and refresh tokens are never persisted by the app.
- Row Level Security is enforced for any browser client; the backend bypasses it
  deliberately using the service-role key for provisioning and privileged writes.
- Inventory changes are recorded as **movements**, preserving an audit trail of
  stock changes rather than mutating a single quantity column.

---

## Testing

```bash
cd backend
cp .env.example .env        # point at a disposable Supabase project
npm run test:integration
```

Type-checking both workspaces before committing is recommended:

```bash
cd backend  && npm run lint
cd frontend && npm run lint
```

---

## Deployment

**PRINTSYNC is not deployed anywhere yet.** It is developed and run locally.

The backend is a long-lived HTTP server — `src/server.ts` calls `app.listen()` —
so it needs a container or server runtime (Render, Railway, Fly.io, a VPS, or
similar) rather than a function-based platform. Whenever hosting is set up:

1. Set `FRONTEND_ORIGIN` on the API to the frontend's exact origin — CORS allows a
   single explicit origin, not a wildcard.
2. Set `VITE_API_BASE_URL` on the frontend to the API's public `/api/v1` URL.
3. Serve the SPA with a catch-all rewrite to `index.html` so client-side routing
   survives a page refresh.
4. Run the API with `NODE_ENV=production` so session cookies get the `Secure` flag.

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
- Keep `.env` files, `supabase/.temp/`, and any database dumps out of version
  control. The provided `.gitignore` already covers these.

---

## Contributing

1. Branch off the working branch (current: `macOS-UI-2`).
2. Keep changes inside the relevant workspace (`frontend/`, `backend/`,
   `packages/shared-types/`). Shared contracts belong in `packages/shared-types`.
3. Run `npm run lint` in the workspaces you touched.
4. Add a migration under `supabase/migrations/` for any schema change — never
   edit an existing migration that has already been pushed.

---

## License

Released under the **MIT License** — see [`LICENSE`](LICENSE).

Copyright (c) 2026 Roi Rendal.
