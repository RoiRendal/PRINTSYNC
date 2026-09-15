# PRINTSYNC — Frontend

The React 19 + Vite single-page application for PRINTSYNC.

> **Full documentation lives in the [root README](../README.md)** — setup,
> environment variables, scripts, architecture, API reference, and permissions.

## Quick start

From this directory:

```bash
npm install
npm run dev          # http://localhost:3000
```

The dev server proxies `/api` to `http://127.0.0.1:4000`, so run the API
alongside it:

```bash
cd ../backend && npm run dev
```

To target an API somewhere else, set `VITE_API_BASE_URL` in `.env`
(see `.env.example`). Vite only exposes `VITE_`-prefixed variables to the
browser — never put secrets here.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server on port 3000 |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Preview the production build |
| `npm run clean` | Remove `dist/` |
| `npm run lint` | Type-check without emitting (`tsc --noEmit`) |

## Source layout

```
src/
├── app/          # Router, layout, providers (auth, theme, notifications, branding)
├── features/     # Vertical slices: auth, orders (+ POS), inventory, customers,
│                 # designs, analytics, users, audit, settings, dashboard
└── shared/       # API client, UI kit, constants, hooks, error handling
```

Each feature folder keeps its own `pages/`, `components/`, `hooks/`, `api/`,
and `types.ts` so a domain can be understood without leaving its directory.

Pages are lazy-loaded and gated by `RequireAuth` / `RequirePageAccess`, which
check the signed-in user's role before rendering a route.

## Conventions

- Call the backend through `shared/api/client.ts` (`apiClient`) — it handles the
  base URL, JSON envelopes, `credentials: 'include'`, and automatic token refresh.
- Shared request/response contracts belong in `packages/shared-types`, not here.
- Use the `shared/components/ui` primitives (Button, Card, Input, Modal, Table,
  Badge, Tooltip) before introducing a new component library.
