# PRINTSYNC — The Legacy Prototype (May 2026)

| | |
| --- | --- |
| **Branch** | `legacy-frontend-prototype` @ `2312077` — also pinned as the tag `archive-frontend-prototype` |
| **Last commit** | 2026-05-10 — *"empty out analytics page"* |
| **Diverges from `main` at** | `b11c23c` (2026-05-06) |
| **What it is** | A UI prototype driven by hard-coded mock data. **Not** an earlier build of the current system. |
| **Status** | **Reference only.** Do not build on it, do not merge it, do not deploy it. |

---

## 1. Why this document exists

The branch is kept deliberately, for the design insight it preserves. A branch nobody
reads is not much of an archive, so this records what is actually in it — enough to
answer "was this considered before?" without checking the branch out.

## 2. What it actually was

- **The whole repository was one Vite app.** 38 files, all frontend, sitting at the
  repository root: `index.html`, `src/`, `package.json`, `vite.config.ts`. There is no
  `backend/`, no `packages/`, no `supabase/`. The monorepo shape came later.
- **Mock data only.** `src/shared/constants/mocks.ts` supplies `MOCK_ORDERS`,
  `MOCK_INVENTORY` and `MOCK_FINANCIAL_RECORDS`. There is no database, no API layer and
  no authentication anywhere in it — **there is no login screen**.
- **Generated from Google AI Studio.** `README.md` is the AI Studio template
  (*"Run and deploy your AI Studio app"*), `metadata.json` holds the app description, and
  `@google/genai` is a runtime dependency. The package name is `react-example`.
- **State was per-feature React Context** (`FinanceContext`, `InventoryContext`) — the
  pattern later replaced by Zustand stores.
- **It ends mid-abandonment.** The final commit cut `AnalyticsPage.tsx` from 133 lines to
  a two-line no-op (`export default function Analytics() { return; }`).

## 3. What is still worth reading

### 3.1 The clearest one-line statement of the product

`metadata.json` describes it better than anything written since:

> "A comprehensive ERP system for custom printing businesses, featuring inventory
> management, POS, finance tracking, and production analytics."

### 3.2 The finance screen tracked money **by print technique**

The prototype had a `finance` feature that the current frontend no longer has. Its
`FinancialRecord` is `{ date, type: 'Income' | 'Expense', category, description, amount }`,
and the mock data reveals the categories the shop actually works in:

| Direction | Categories in the mock data |
| --- | --- |
| Income | Screen Printing, DTF Printing, Embroidery, Sublimation |
| Expense | Material, Rent, Inventory, Utilities |

`FinancialStats` was `{ totalRevenue, totalExpenses, netProfit, profitMargin }`.

**Why this matters:** tracking revenue *by technique* is a real business question —
"which service line actually pays for the rent?" — and it is not currently answerable.
Today money is tracked through the expenses and suppliers modules plus analytics, and
`frontend/src/features/finance/` does not exist. If per-technique profitability is ever
wanted, this is the model it had, and these are the categories it used.

### 3.3 The domain model is recognisably today's

`src/shared/types/domain.ts` is the direct ancestor of `packages/shared-types`. What
survived, and what changed:

| Concept | Prototype (May 2026) | Today |
| --- | --- | --- |
| Order status | 6 values including `Shipped` | Same set, with **`Delivered` replacing `Shipped`** |
| Order lines | `lineItems[]` optional, with a `designId` per line | Survived — now required, with `unitPrice` per line |
| Customer | just `customer: string` on the order | A **first-class entity**: own feature, module and migrations, with `customerId` added beside the original name |
| Custom jobs | `isCustom`, `designId`, `notes` on order and cart item | All three survived unchanged |
| Money owed | *nothing* — no concept of a balance | `dueDate`, `totalPaid`, `balanceDue` |
| Payment | `paymentMethod: 'Cash' \| 'Card'`, `tax` on the transaction | `'Cash' \| 'Card' \| 'Other'`, with idempotency keys, order payments and receipts from a snapshot |
| Shared types | `src/shared/types/domain.ts` | `packages/shared-types`, compiled and shared by backend and frontend |

### 3.4 Realistic seed values

The mock data is a usable starting point for demo data: order sizes of **15–50 units**,
blank apparel at **5.20–15.00**, orders of **450–1 500**, monthly rent **5 000**,
electricity **1 200**, and item IDs following the `ORD-001` / `INV-001` / `FIN-001`
convention still in use.

⚠️ **Treat these as shapes, not currency.** The two mock files disagree on scale — an
order of 50 shirts is `450.00` in `mocks.ts` and `45 000` in the finance records — so the
units are inconsistent and should not be copied as amounts.

## 4. What it does not have

Everything that makes the current system shippable. This is why the prototype cannot be
reused as a starting point, only read:

| Missing | Present today |
| --- | --- |
| Any backend at all | Express API with a service layer and Zod-validated contracts |
| Database | Supabase Postgres, **27 migrations** |
| Authentication / permissions | Supabase Auth, HttpOnly cookies, a seeded role/permission model |
| Real payments | Idempotent checkout, order payments, reconciliation by attempt key |
| Inventory integrity | Movements ledger, `for update` row locks in Postgres RPCs |
| Tests | 202 backend + 112 frontend |
| CI, deployment | GitHub Actions gate, one-address Render deploy |

## 5. How to look at it

```bash
# read a single file without checking the branch out
git show legacy-frontend-prototype:src/shared/constants/mocks.ts
git show legacy-frontend-prototype:src/shared/types/domain.ts

# see everything the prototype had that main does not
git diff b11c23c legacy-frontend-prototype --stat

# restore the branch locally if it is ever deleted
git branch legacy-frontend-prototype archive-frontend-prototype
```

The tag exists so that deleting the branch a second time cannot lose the commit.
