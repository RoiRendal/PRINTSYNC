# PRINTSYNC — Live Data Synchronisation

**Implementation plan for the development team**

| | |
| --- | --- |
| **Reported by** | Operations (management) |
| **Business requirement** | Data changed anywhere in the system must appear everywhere immediately. Staff must never need to reload a page to see current information. The system must hold up with several staff members working at the same time. |
| **Status** | Tier 1 **implemented and verified**. Tier 2 **implemented and verified live**. Tier 3 **implemented and verified live** (§5). |
| **Verified by** | Backend unit suite **174/174 passing**; `tsc --noEmit` clean on frontend, backend and backend tests; `npm run build` succeeds on all three workspaces; **26/26 live end-to-end checks** against the real Supabase project (§5.4); both new migrations applied and in sync |

---

## 1. The business problem

> "Whenever I do something in the system — for example, add a new item in the
> inventory — the other pages, including the one I'm on, should load the change
> immediately. Staff shouldn't have to keep restarting the page to see changes.
> This should apply to all data changes throughout the system."

Concretely, this is what a cashier experienced before this change:

- A product was sold out. The POS screen kept showing **"5 stock"** and kept the
  product **clickable** for the rest of the shift. The cashier only found out the
  item was gone at checkout, with the customer standing there.
- An admin added a new inventory item. The **Dashboard** inventory-alert count
  and the **Analytics** forecast did not move until they navigated away and back.
- The **Dashboard** "Today's Revenue" figure stayed frozen at whatever it was when
  the page was opened — every sale in between was invisible.
- Two staff on different workstations could not see each other's work at all,
  ever, until both reloaded.

## 2. Root cause (technical)

Three independent defects, all in the frontend data layer. The backend was **not**
at fault — see §5.

**2.1 — The cache was loaded once and never refreshed.**
`frontend/src/shared/store/createListStore.ts` exposed an `ensureLoaded()` guard:

```ts
ensureLoaded: async () => {
  const { hasLoaded, isLoading } = get();
  if (hasLoaded || isLoading) return;   // ← permanent after the first load
  await get().fetchList();
}
```

Every collection (orders, inventory, customers, designs, users) is primed exactly
once per browser session. There was **no** trigger that ever re-fetched it: no
window-focus handler, no route-change handler, no interval, no server push.
`grep` for `setInterval`, `visibilitychange`, `focus`, `EventSource`, `WebSocket`,
`BroadcastChannel` across `frontend/src` returned **zero** data-refresh hits. The
only way to refresh was a hard reload.

**2.2 — A mutation only patched its own local list.**
`addItem`, `updateOrder`, etc. called `mutateItems(...)` on their own store slice.
Nothing announced the change to the rest of the app. Cross-domain side effects
were lost entirely — most importantly a retail sale, which writes a payment row
*and* decrements inventory server-side, but only patched the local transaction
array. The inventory store was never told, so the POS catalogue and Dashboard
kept showing pre-sale stock.

**2.3 — Derived views fetched on mount and were never invalidated.**
`useAnalyticsData`, `POSPage`'s transaction history, `useAuditLogs` and
`SettingsPage` each held data in local `useState` with a mount-only `useEffect`.
They refreshed only because navigating away unmounted them. Left open, they were
permanently stale.

## 3. Tier 1 — Implemented

The fix introduces a single, explicit freshness model rather than sprinkling
`setInterval` calls through components. Everything below is done and compiles.

### 3.1 New: `frontend/src/shared/store/dataEvents.ts`

A small synchronous pub/sub bus. One place where "the data in domain X changed"
is announced, so that a change made by a POS sale, an order edit, or a background
refresh all travel the same path.

```ts
export type DataDomain =
  | 'orders' | 'inventory' | 'customers' | 'designs'
  | 'users' | 'payments' | 'settings';

export function emitDataChange(...domains: DataDomain[]): void;
export function subscribeToDataChanges(listener: DataChangeListener): () => void;
```

Domains are **batched into one call**, so a single user action that touches
several domains wakes each subscriber once, not once per domain.

### 3.2 Changed: `createListStore.ts` — a real freshness model

| Added | Purpose |
| --- | --- |
| `lastFetchedAt: number \| null` | When the current page was last confirmed against the server. |
| `isRevalidating: boolean` | A *background* refresh is running. Never used to blank the view. |
| `staleTime` option (default 15s) | How long a page is trusted before a trigger may refetch it. |
| `isStale()` | `true` when the page should be refetched before being trusted. |
| `invalidate()` | Marks the cache stale so the next `revalidate()` refetches. |
| `revalidate()` | **The key method.** Refetches only if stale, never shows the loading state, never blanks the data. |

Two design decisions matter operationally:

- **A failed background refresh keeps the last good data on screen.** Blanking a
  cashier's product grid because one poll timed out would be worse than showing
  data a few seconds old. `lastFetchedAt` is left untouched so the next trigger
  retries.
- **Every local mutation stamps the cache as fresh.** The mutation's own response
  *is* authoritative server data, so a mutation does not trigger a pointless
  refetch of the page it just updated. Without this, the domain event would bounce
  straight back.

> **Bug found and fixed during review:** the freshness stamp was first written as
> a module-level constant (`const markFresh = { lastFetchedAt: Date.now() }`).
> Because the store factory runs once, that timestamp froze at store-creation
> time and every page would have looked permanently fresh — silently disabling
> revalidation entirely. It is now a function, evaluated per mutation. Flagging it
> because it is exactly the class of bug that passes a type-check and fails in
> production.

### 3.3 Changed: the five list stores emit events

`useOrderStore`, `useInventoryStore`, `useCustomerStore`, `useDesignStore`,
`useUserStore` now announce their changes after every successful mutation.
Cross-domain effects are declared explicitly:

| Action | Domains announced | Why |
| --- | --- | --- |
| `addOrder` | `orders`, `inventory` | Order creation can move stock server-side. |
| `recordPayment` | `orders`, `payments` | Changes the order balance, dashboard revenue, and transaction history. |
| POS retail sale | `payments`, `inventory` | Writes a payment **and** decrements stock. |
| POS void | `payments`, `inventory` | Voiding restores the stock the sale consumed. |

### 3.4 New: `frontend/src/app/hooks/useDataRevalidation.ts`

The single driver, mounted once in `AppProviders` and disabled while signed out.
It turns three signals into refreshes:

1. **Domain events** — a mutation happened in this tab; non-originating stores
   refetch.
2. **Returning to the tab** — `focus`, `visibilitychange`, and regaining
   connectivity, with a 5-second cooldown so alt-tabbing to the receipt printer
   does not cause a request storm.
3. **A 60-second background poll** — the interim answer for cross-workstation
   freshness. Tier 2 has since landed, so this now runs **only while the push
   channel is not live** — see §4.2, deviation 2.

Every path funnels into `revalidate()`, which no-ops while the cache is fresh.
That is what makes it safe for all three to fire at once.

### 3.5 Changed: `app/stores/index.ts`

Maps each domain to its owning store. Two deliberate guards:

- `revalidateIfLoaded()` skips any store this user has not loaded. `users` is
  admin-only, so an unconditional refresh would make a **staff session hit an
  endpoint it is not authorised for** and paint a 403 onto a page nobody opened.
- `payments` and `settings` map to no-ops. They have no list store; their
  consumers subscribe to the bus directly.

### 3.6 Changed: derived views subscribe to the bus

- `useAnalyticsData` — a debounced `reloadToken` re-runs all five panels when
  orders, inventory, payments, customers, designs, or settings change.
- `POSPage` transaction history — reloads on `payments`.
- `useAuditLogs` — debounced refetch on any change (nearly every privileged
  action writes an audit row).

Debouncing (400 ms) is deliberate: one POS sale announces two domains, and one
action must not fire five parallel dashboard queries twice over.

### 3.7 Files touched

```
NEW   frontend/src/shared/store/dataEvents.ts
NEW   frontend/src/app/hooks/useDataRevalidation.ts
MOD   frontend/src/shared/store/createListStore.ts
MOD   frontend/src/app/stores/index.ts
MOD   frontend/src/app/providers/AppProviders.tsx
MOD   frontend/src/app/stores/useOrderStore.ts
MOD   frontend/src/app/stores/useInventoryStore.ts
MOD   frontend/src/app/stores/useCustomerStore.ts
MOD   frontend/src/app/stores/useDesignStore.ts
MOD   frontend/src/app/stores/useUserStore.ts
MOD   frontend/src/features/analytics/hooks/useAnalyticsData.ts
MOD   frontend/src/features/orders/pages/POSPage.tsx
MOD   frontend/src/features/audit/hooks/useAuditLogs.ts
```

No backend change was required. No database migration was required.

### 3.8 How to verify (manual acceptance test)

1. Sign in as admin. Open **Dashboard** and **Inventory** in two browser tabs.
2. In tab 2, add an inventory item. Switch to tab 1 **without reloading** →
   the stock-alert count and Stock Vitality list must already be correct.
3. Open **Analytics** and leave it open. Ring up a sale in **POS** → the revenue
   and product-trend figures must move within ~1 second, with no reload.
4. Sell a product down to 0 in **POS** → the catalogue tile must become greyed out
   and disabled immediately.
5. Leave **POS** open for 2 minutes, then return to the tab → figures refresh.
6. Sign in as staff (`noah@printsync.com`) and confirm the Network tab shows
   **no** request to `/api/v1/users`.

---

## 4. Tier 2 — Server push (implemented and verified)

**Status: implemented and verified live.** Evidence in §4.3.

**Why this was needed.** Tier 1 made a single workstation self-consistent and let
*other* workstations catch up within 60 seconds (the poll). That is not
"industry level" for a counter where two cashiers sell the same stock. The real
fix is for the server to tell every connected client when something changed.

**Chosen: Server-Sent Events (SSE).** Not WebSockets — the traffic is
one-directional server→client, SSE reconnects automatically, and it works over
plain HTTP with the existing cookie auth.

**Alternative considered and rejected: Supabase Realtime.** It would require
shipping the Supabase anon key to the browser and making RLS the security
boundary. That directly contradicts the existing (and correct) architecture
decision in `README.md` §Security: *"It never talks to Supabase directly — all
data access goes through the backend."* SSE preserves that boundary.

### 4.1 Backend — built as specified

1. **`backend/src/services/domainEventBus.ts`** — in-process fan-out exposing only
   `publishDataChange(...)` / `subscribeToDataChange(handler)`. The interface is
   deliberately tiny so the transport can be swapped for Postgres
   `LISTEN`/`NOTIFY` without touching a single call site. Publishing never throws
   and never blocks: a subscriber that throws is logged and skipped, because the
   write has already committed and must not be affected by a broken connection.
2. **`GET /api/v1/events`** — `backend/src/routes/events.routes.ts`.
   - Reuses the existing `authenticate` middleware (cookie-based). No new auth.
   - Guarded by `authenticate` **only, not `requirePermission`** — there is no
     single capability meaning "may watch for changes", so the gate is applied per
     event instead. The payload carries no business data, only domain names.
   - The permission mapping lives in
     `backend/src/services/dataChangePermissions.ts` so the security boundary can
     be unit-tested without Express or Supabase.
   - Headers exactly as specified, plus `response.flushHeaders()` so the client
     sees the connection open immediately instead of waiting for the first event.
   - `: ping` heartbeat every 25 s.
   - One idempotent `teardown()` wired to both `request.on('close')` and
     `response.on('error')`, clearing the interval and unsubscribing. A leaked
     interval keeps the process alive; a leaked subscriber writes to a dead socket
     forever — this is the part of an SSE endpoint that actually matters.
3. **Publishing from the mutation path.** All eight mutating route modules publish
   **after** the write commits — never before, so a failed write cannot make every
   client refetch data that never changed. Cross-domain effects are explicit:

   | Route | Publishes | Why |
   | --- | --- | --- |
   | `inventory` create / update / movement / delete | `inventory` | — |
   | `orders` create | `orders`, `inventory` | `create_order_with_items` reserves stock |
   | `orders` update | `orders`, `inventory` **only when line items changed** | `replace_order_with_items` re-reserves; a status-only edit does not |
   | `orders` delete | `orders`, `inventory` | `delete_order_with_items` releases stock |
   | `order_payments` create / delete | `orders`, `payments` | Moves the order's balance due |
   | `payments` transaction create / void | `payments`, `inventory` | One RPC writes a payment **and** decrements stock |
   | `customers`, `designs`, `users`, `settings` | their own domain | — |

   `POST /designs/assets` deliberately does **not** publish: it stores an image and
   returns a URL, creating no design row. Broadcasting there would wake every
   designs page for a record that does not exist yet. `suppliers` and `expenses`
   have no list store or consumer, so they are not wired to the bus.
4. **Multi-instance caveat — still open, as anticipated.** The in-process bus only
   reaches clients connected to *that* API instance. Fan out via Postgres
   `LISTEN`/`NOTIFY` when the API is scaled past one instance. No call site will
   need to change.

### 4.2 Frontend — built as specified, with two deliberate deviations

1. **`frontend/src/shared/realtime/eventStream.ts`** — `EventSource` with
   `withCredentials: true` (required: `VITE_API_BASE_URL` is absolute, so the
   stream is cross-origin), exponential backoff with ±20% jitter (1 s → 30 s cap)
   so a shop full of workstations does not stampede the API, and an immediate
   reconnect on `online`. Three things the native client does **not** handle were
   added explicitly:
   - **A fatal close.** A non-200 response — an expired access token, most likely —
     makes the browser close the stream *permanently* rather than retrying. The
     client detects `CLOSED`, calls `/auth/refresh` once, then redials. Without
     this, a workstation left open past the access-token lifetime would never
     reconnect, because nothing else in the app makes a request while idle.
   - **A half-open socket.** If the network drops without a TCP reset — a laptop
     sleeping, a switch rebooting — the stream stays "open" and silently delivers
     nothing. A watchdog treats three missed heartbeat intervals (75 s) as dead and
     reconnects.
   - **React StrictMode's double mount.** The stream is reference-counted, so the
     development mount → unmount → mount cycle cannot open a second connection and
     waste one of the browser's six connections per origin.
2. **Each frame calls the existing `emitDataChange(...)`** — the Tier 1
   revalidation layer is reused **unchanged**. No rework was required, which is
   exactly what the Tier 1 design was for.
3. **Deviation 1 — `forceRevalidate()` added to the store contract.** This was
   *not* in the plan and turned out to be essential. `revalidate()` no-ops while
   the cache is fresh (15 s `staleTime`), so a push arriving five seconds after a
   fetch would have been **silently discarded** — defeating the entire feature
   while still looking like it worked. A domain event is authoritative, so it now
   bypasses `staleTime`. The time-based triggers still respect it, which is what
   keeps them from storming.
4. **Deviation 2 — the poll was reduced, not retired.** The plan said set
   `BACKGROUND_POLL_MS = 0`. It is now 60 s and fires **only while the stream is
   not live**. Retiring it outright would mean a broken push channel leaves the app
   silently stale — the exact failure this work set out to remove. As a fallback it
   degrades to Tier 1 behaviour instead of to nothing.
5. **`ConnectionStatus`** in the page toolbar — a Live / Connecting / Reconnecting
   / Offline chip with a plain-language hover explanation. Staff otherwise have no
   way to tell "current" from "stopped updating ten minutes ago", and the first
   symptom of a dropped stream would be someone deciding on stale stock.

**Files touched by Tier 2.**

```
NEW   backend/src/services/domainEventBus.ts
NEW   backend/src/services/dataChangePermissions.ts
NEW   backend/src/routes/events.routes.ts
NEW   backend/tests/unit/domainEventBus.test.ts
NEW   backend/tests/unit/dataChangePermissions.test.ts
NEW   packages/shared-types/src/dataEvent.ts
NEW   frontend/src/shared/realtime/eventStream.ts
NEW   frontend/src/shared/api/baseUrl.ts
NEW   frontend/src/app/hooks/useRealtimeStatus.ts
NEW   frontend/src/app/components/ConnectionStatus.tsx
MOD   backend/src/app.ts                                  (mount /api/v1/events)
MOD   backend/src/routes/{inventory,orders,orderPayments,payments,
                          customers,designs,users,settings}.routes.ts
MOD   packages/shared-types/src/index.ts
MOD   frontend/src/shared/store/createListStore.ts        (forceRevalidate)
MOD   frontend/src/shared/store/dataEvents.ts             (shared domain union)
MOD   frontend/src/shared/api/client.ts                   (shared base URL)
MOD   frontend/src/app/stores/index.ts                    (thread `force`)
MOD   frontend/src/app/hooks/useDataRevalidation.ts       (own the stream)
MOD   frontend/src/app/layout/AppLayout.tsx               (mount the indicator)
```

No database migration was required. The event contract lives in
`packages/shared-types/src/dataEvent.ts` and is consumed **types-only** by the
frontend, matching how every other shared contract is used.

### 4.3 Verification

**Automated.**

- `backend/tests/unit/domainEventBus.test.ts` — 14 cases: delivery, batching,
  domain de-duplication, the ISO timestamp, the empty-publish no-op, failure
  isolation (a throwing subscriber does not block the others), unsubscribing
  *during* dispatch, idempotent unsubscribe, subscriber counting.
- `backend/tests/unit/dataChangePermissions.test.ts` — 8 cases covering the
  security boundary, including that `order_payments.read` does **not** imply
  `payments.read`, that `users.manage` does not imply `users.read`, and that staff
  receive every domain except `users`.
- Backend unit suite: **170 tests, 170 passing.** Backend `tsc --noEmit` clean.
  Frontend unchanged at its 16 pre-existing errors (§6.1). `npm run build`
  succeeds on both workspaces.

**Live**, against the real Supabase project with the API running:

| Check | Result |
| --- | --- |
| `GET /api/v1/events` with no session | **401** |
| Admin `connected` frame | all 7 domains |
| Staff (`noah@printsync.com`) `connected` frame | **6 domains — `users` correctly absent** |
| Admin creates a customer → staff's already-open stream | `data-change: ["customers"]` received |
| Admin deletes it → staff's open stream | second `data-change` received |
| Heartbeat | `: ping` received after 25 s |
| Staff `GET /users` | **403** — confirms the filter's premise |
| Staff `GET /orders`, `GET /payments/transactions` | 200 — confirms staff hold `payments.read` |

The test created one customer and deleted it in the same run; the database was
confirmed clean afterwards.

**Acceptance criterion met:** a change made by one signed-in user appeared on a
*different* user's already-open stream, with no reload and no polling.

### 4.4 Deployment caveat — check this before going live

The auth cookies are set `SameSite=Lax`. That works today because the frontend and
the API are both on `localhost`, and it will keep working if they are deployed as
`app.example.com` + `api.example.com` — those are different *origins* but the same
*site*. It will **break both the REST API and the stream** if they are ever hosted
on different registrable domains (for example a `vercel.app` frontend calling an
`onrender.com` API): the browser simply will not send the session cookie, and the
symptom will look like "login silently fails". In that case the cookies need
`SameSite=None; Secure`, and CORS must keep echoing an explicit origin rather than
`*`.

Also worth knowing: an open `EventSource` holds one of the browser's six
connections per origin. Under HTTP/1.1 that leaves five for regular requests —
acceptable, but one more argument for serving the API over HTTP/2 in production.

---

## 5. Tier 3 — Hardening for daily multi-staff operation (implemented and verified)

### 5.1 What was already good (verified, no action needed)

Worth stating plainly, because it is a real strength and it was checked rather
than assumed. The backend is **correctly built for concurrent staff**:

- `create_transaction_with_payment`, `void_transaction`, `adjust_inventory_stock`
  and the order RPCs are Postgres functions, so each runs in **one atomic
  database transaction**. A sale cannot half-commit.
- They take row locks (`for update` — see
  `supabase/migrations/20260910001100_payments_transactions.sql:165` and
  `…1300_transactional_lifecycle.sql:90,169,302`), so two cashiers selling the
  last unit serialise correctly instead of both succeeding.
- They reject overselling explicitly:
  `raise exception 'Inventory item is unavailable or stock is insufficient'`.
- Inventory changes are recorded as **movements**, not by overwriting a column,
  so stock has an audit trail.
- The service-role key is confined to `backend/.env` and never reaches the
  browser.

So the multi-staff requirement was already sound at the data layer. The gaps below
were about money-safety, error reporting, and what happens when two people touch
the same record — not about the atomicity of a single write.

### 5.2 What this tier changed

| # | Defect | What it cost in practice | Status |
| --- | --- | --- | --- |
| 1 | No idempotency on checkout | A double-click, or a retry after a dropped response, created **two sales and charged twice**. | Fixed |
| 2 | Generic checkout failure | The database knew exactly which item was short and by how much; the cashier saw "the transaction could not be completed" and had to guess. | Fixed |
| 3 | Last-write-wins on order edits | Two staff editing one order: the second save silently discarded the first person's work, with no warning to either. | Fixed |
| 4 | No type-check gate, no CI | 16 type errors had accumulated unnoticed; nothing stopped more. | Fixed |

#### 5.2.1 Double-charge protection

`supabase/migrations/20260916000000_idempotent_sales_and_stock_errors.sql`

- `sales_transactions` gains a nullable `idempotency_key` plus a **partial unique
  index** (`where idempotency_key is not null`), so existing rows are unaffected
  and a duplicate key is rejected by the database rather than by application code.
- `create_transaction_with_payment` gains `p_idempotency_key`. The **replay guard
  runs first, before validation** — deliberately. A retry exists precisely
  because the first attempt may have committed with its response lost, and that
  attempt has *already deducted stock*; re-validating would reject the very retry
  the mechanism is there to protect. An `exception when unique_violation` branch
  closes the check-then-act window, so two simultaneous retries still yield one sale.
- The API requires the key (`z.string().uuid()`), so a client that forgets it
  fails loudly instead of quietly losing its protection.
- The POS mints **one key per checkout attempt**, reuses it across retries of that
  attempt, and rotates it on success or when the cart changes. A key is *not*
  cleared by closing the checkout dialog — otherwise the exact scenario the key
  defends against (committed, response lost, cashier tries again) would get a new
  key and charge twice.
- The Confirm button is disabled while a sale is in flight, so the second click of
  a double-click is never sent at all.

#### 5.2.2 A short-stock sale now says which item

- The RPC raises with structured context rather than a sentence alone:
  `itemId`, `itemName`, `available`, `requested`.
- `AppError` gained an optional `details` field, the error envelope carries it, and
  the client reads it back off `ApiError.details` — so the UI branches on a
  machine-readable code instead of pattern-matching on prose.
- The POS flags **the exact cart line** — "Only 1 left — 2 requested" — and
  refreshes the catalogue, because the stock figure on screen was what was wrong.
- The failure is rendered **inside** the checkout dialog. The page-level error
  banner sits behind the overlay, so previously a rejected sale looked like the
  button doing nothing.

#### 5.2.3 Two staff can no longer overwrite each other silently

`supabase/migrations/20260916000001_optimistic_order_updates.sql`

- `replace_order_with_items` gains `p_expected_updated_at`. The comparison happens
  **after** the `for update` row lock, so a save arriving while another is still in
  flight waits for it and then sees the committed version instead of racing past it.
- The status/notes-only path has no RPC, so it uses a **compare-and-swap**:
  `.eq('updated_at', expected)`. The statement matches no row at all if someone got
  there first. A lost race is reported as a conflict, not as a misleading 404.
- `OrderRecord` and the frontend `Order` now expose `updatedAt`, and the PATCH body
  requires `expectedUpdatedAt`. Both the Orders board and the POS edit form send
  the version they actually loaded — the POS captures it when the cart is
  hydrated, *not* from the live store, because a background refresh would otherwise
  hand it a newer version and let it overwrite the very change it should catch.
- A lost race returns `409 ORDER_CONFLICT` carrying both versions. The Orders board
  explains it and refreshes the row; the checkout dialog says to reopen the order.

#### 5.2.4 The type-check and CI gate

- All 16 frontend type errors cleared, including the one real defect: `AuditLogPage`
  used a local union where neither `'default'` nor `'yellow'` exists in
  `BadgeVariant`, so the badge rendered with no styling at all.
- `.github/workflows/ci.yml` runs lint, the unit suite, and both builds on every
  push, with the shared-types package built first (the backend type-checks against
  its `dist`, so ordering matters). `test:integration` is deliberately excluded —
  it needs live Supabase credentials, which do not belong in CI.

### 5.3 A defect found *while* verifying this tier

The live run exposed a Tier 2 bug that no unit test could have caught.

The client uses the browser's `EventSource`. **`EventSource` never surfaces
comment frames to script** — so the `: ping` keep-alive the server was sending was
invisible to the client's watchdog, which saw three silent intervals on a
perfectly healthy connection and forced a reconnect every 75 seconds. The stream
worked, but it was needlessly redialling all shift, and each redial is a window in
which a pushed change can be missed.

The heartbeat is now a **named `heartbeat` event**. The distinction is the whole
fix: a comment keeps the socket alive on the wire but cannot be observed, and
observability is the entire reason the watchdog exists. Confirmed on the wire —
three `heartbeat` frames over 80 seconds, 25s apart, with no legacy comment.

This is also why the tier was verified live rather than only in tests: the server
*sending* a heartbeat and the browser *being able to see* one are different claims,
and only the first is testable in isolation.

### 5.4 Verification

| Check | Result |
| --- | --- |
| Backend unit suite | **174/174 passing** (22 added across Tiers 2 and 3) |
| `tsc --noEmit` — frontend, backend, backend tests | **Clean** |
| `npm run build` — frontend, backend, shared-types | **Succeeds** |
| Live end-to-end against the real Supabase project | **26/26 checks passed**, zero server errors |
| Database migrations applied | Both registered; `migration list` in sync |

The live run exercised, against the real database: a repeated checkout with one
key returning the *same* sale; a checkout with no key rejected; an oversell
returning `409` naming the item and the real numbers, with a sale that *fits*
still succeeding afterwards (proving the rejected attempt consumed no stock); a
stale order save returning `409` with both versions; and every probe cleaning up
after itself.

### 5.5 Known limits — deliberate trade-offs, not oversights

- **A replayed checkout returns `201` and writes a second audit entry.** The RPC's
  return value carries no "was this a replay?" signal, and adding one would mean
  duplicating a 120-line `SECURITY DEFINER` function, since `create or replace`
  cannot change a return type. The guarantee that matters holds — one transaction,
  one charge, one stock deduction — so the audit log records a create *request*
  being served rather than a row being inserted. Worth revisiting only if the audit
  trail is ever used to count sales; sales should be counted from the table.
- **The residual double-charge window.** If an attempt commits, its response is
  lost, *and* the cashier edits the cart before retrying, the changed cart gets a
  new key and a second sale. Keeping the key stable across a dialog close/reopen
  removes the common path; the remaining one needs a reconciliation view
  ("sales in the last 5 minutes") to be fully closed.
- **`updatedAt` must round-trip verbatim.** It is a version token, not a date. A
  client that parses it with `new Date()` and re-serialises would drop the
  microseconds and see *every* save as a conflict. That failure is loud, not
  silent, which is the right direction to fail in — but the field is documented
  accordingly on both sides.
- **Realtime is still single-instance.** See §4.4. Unchanged by this tier.

### 5.6 Still open, in priority order

| # | Item | Business value | Technical approach |
| --- | --- | --- | --- |
| 1 | **Optimistic UI** | Staff see their action land instantly instead of waiting on the network. Perceived speed on a slow connection. | Mutations currently `await` the server before touching the UI. Apply the change locally first, then reconcile; roll back and toast on failure. The store already exposes `mutateItems`/`replaceItem` for this. |
| 2 | **A "recent sales" reconciliation view** | Closes the residual double-charge window in §5.5, and lets a cashier confirm a sale that appeared to fail. | A small read-only list of the last few transactions per workstation, refreshed on checkout failure. |
| 3 | **Expose `isRevalidating` in the UI** | Reassures staff that the screen is live. | The flag already exists and is unused; render a subtle "syncing" indicator. |
| 4 | **Frontend tests** | The revalidation and idempotency-key timing logic has no coverage, and it is the part that regresses silently. | Vitest + Testing Library; see §6.5. |
| 5 | **Scheduled/paginated analytics caching** | Analytics issues 5 queries on every change event. Fine now; will need attention at volume. | A short server-side cache or a materialised view for the summary RPC. |
| 6 | **Postgres `LISTEN`/`NOTIFY` for the event bus** | Removes the single-instance ceiling on realtime. | See §4.4 — the call sites will not need to change. |

---

## 6. Other findings from the scan

These are outside the reported request but affect readiness for real operations.

### 6.1 The frontend type-check — **fixed in Tier 3**

`npm run lint` in `frontend/` was failing with **16 errors across 8 files**. None
were in the files changed by Tier 1 or 2, and `npm run build` still succeeded
(Vite strips types without checking them), which is why it went unnoticed — the
type system was not actually gating anything.

```
src/app/components/NotificationPanel.tsx          unused parameter
src/app/layout/AppLayout.tsx                      unused import
src/app/providers/NotificationProvider.tsx        unused ref
src/features/audit/pages/AuditLogPage.tsx         unused imports + invalid Badge variant
src/features/customers/pages/CustomersPage.tsx    unused import
src/features/orders/components/orders/OrderDetailModal.tsx   unused imports
src/features/orders/components/orders/OrdersTable.tsx        unused imports
src/features/settings/api/exportApi.ts            unused import
```

All 16 are now cleared. Most were dead code, but one was a genuine defect:
`AuditLogPage` declared its own `'default' | 'green' | 'blue' | 'red' | 'purple' |
'yellow'` union, and neither `'default'` nor `'yellow'` exists in `BadgeVariant` —
so `variantClasses[variant]` resolved to `undefined` and the action badge rendered
with **no styling at all**. It now uses the shared `BadgeVariant` type, with the
mapping from action to variant written out explicitly.

### 6.2 CI — **added in Tier 3**

`.github/workflows/ci.yml` now runs on every push and pull request:

| Job | Steps |
| --- | --- |
| `shared-types` | lint, build, upload `dist` as an artifact |
| `backend` | needs `shared-types`; downloads the artifact, then lint, lint:tests, test:unit, build |
| `frontend` | lint, build |

The `shared-types` job is not decoration: the backend resolves
`@printsync/shared-types` to `../packages/shared-types/dist/index.d.ts`, so without
building it first the backend job fails for reasons that have nothing to do with
the change under review. `test:integration` is deliberately excluded — it requires
live Supabase credentials, which should not be stored in CI.

**Still recommended:** protect `macOS-UI-2` so a red build cannot be merged.

### 6.3 Credentials that must never reach production

- `0_never-push-this-dump-folder/postgre-supabase-data/0_profiles.txt` contains
  **plaintext account passwords** for the admin and two staff accounts. The
  values are deliberately not reproduced here — see that file directly. The
  folder *is* correctly gitignored (`**/0_never-push-this-dump-folder/`), so this
  is not a leak today.
  **But those default development passwords must be rotated before any
  deployment.** Predictable credentials on a reachable URL are the single
  highest-impact risk in this codebase.
- `backend/.env` holds the live `SUPABASE_SERVICE_ROLE_KEY`. Correctly gitignored,
  but it must move to a secrets manager (or the host's environment variables)
  before deployment, and the key should be rotated at that point.
- `frontend/.env` is clean — no secrets, only the API base URL. Good.

### 6.4 Repository hygiene

`frontend/vercel.json`, `frontend/.vercel/`, `backend/.vercel/`, and the
`.tmp-verify/` directories are leftovers from an earlier experiment. `README.md`
already notes they are unused and safe to delete.

### 6.5 No frontend tests

`backend/tests/integration/` exists, but the frontend has no test setup at all.
The revalidation behaviour added here is precisely the kind of cross-component
timing logic that regresses silently. **Recommendation:** Vitest + Testing Library,
starting with three cases — mutation announces the right domains; `revalidate()`
no-ops while fresh; a failed background refresh leaves data intact.

---

## 7. Summary for management

| | Before | After Tier 1 | After Tier 2 | After Tier 3 |
| --- | --- | --- | --- | --- |
| Change made on the same page | Visible | Visible | Visible | Visible |
| Change visible on other pages, same workstation | Only after reload | Immediate | Immediate | Immediate |
| Change made by another staff member | Never visible | Within 60s | Under 2s | Under 2s |
| Sold-out product in POS | Stays clickable | Corrected immediately | Corrected immediately | Corrected immediately |
| Screen left open unattended | Frozen | Self-refreshes | Self-refreshes | Self-refreshes, no wasted redials |
| Staff action requires a page reload | Always | Never | Never | Never |
| A double-click at checkout | Charges twice | Charges twice | Charges twice | **Charges once** |
| "Out of stock" at checkout | "Transaction failed" | "Transaction failed" | "Transaction failed" | **Names the item and how many are left** |
| Two staff editing one order | Second save silently wins | Same | Same | **Second save is refused; both are told** |
| A type error reaching the codebase | Undetected | Undetected | Undetected | **Blocked by CI** |

All three tiers are done and verified against the real system. Tier 1 made a
change visible everywhere on the workstation; Tier 2 extended that to every
workstation in under a second; Tier 3 hardened the parts that cost money or lose
work when several people use the system at once.

**The two items that matter most before release are unchanged, and neither is a
code problem:**

1. **Rotate the default development passwords** (§6.3). Predictable credentials on
   a reachable URL are the highest-impact risk in the codebase.
2. **Move `SUPABASE_SERVICE_ROLE_KEY` out of `backend/.env`** into the host's
   secrets (§6.3), and rotate it at that point.

Beyond those, the highest-value next work is **§5.6**: a "recent sales"
reconciliation view, frontend tests for the timing logic, and the `LISTEN`/`NOTIFY`
change that lifts the single-instance ceiling on realtime (§4.4).
