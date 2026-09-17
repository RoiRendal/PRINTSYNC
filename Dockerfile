# PRINTSYNC — single-origin deployment image.
#
# The API serves the built SPA from the same address. That is not a convenience:
# the session cookie is `SameSite=Lax`, and nearly every free hosting platform has
# its default domain on the public suffix list, so a frontend service and an API
# service on that platform are *different sites* to the browser. Login would
# appear to succeed and then behave as if signed out, and the server-sent event
# stream would fail with it. One origin removes the problem rather than working
# around it, and removes CORS along with it.
#
# `PORT` is injected by the hosting platform; `config/env.ts` defaults to 4000.

# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1 — build all three workspaces
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /repo

# Manifests and lockfiles first. A source-only change then reuses the cached
# dependency layers instead of reinstalling everything.
COPY packages/shared-types/package.json packages/shared-types/package-lock.json packages/shared-types/
COPY backend/package.json backend/package-lock.json backend/
COPY frontend/package.json frontend/package-lock.json frontend/

RUN cd packages/shared-types && npm ci
RUN cd backend && npm ci
RUN cd frontend && npm ci

COPY packages/shared-types/ packages/shared-types/
COPY backend/ backend/
COPY frontend/ frontend/

# Relative, so the bundle calls whatever origin is serving it. An absolute URL
# here would be baked in at build time and would point at a developer's machine
# in production.
ENV VITE_API_BASE_URL=/api/v1

# Order matters. The backend resolves `@printsync/shared-types` to the *compiled*
# declarations in `packages/shared-types/dist`, so those must exist before the
# backend is type-checked. Building the backend first fails.
RUN cd packages/shared-types && npm run build
RUN cd frontend && npm run build
RUN cd backend && npm run build

# ---------------------------------------------------------------------------
# Stage 2 — runtime
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime

# Sets the `Secure` flag on the session cookie and drops
# `upgrade-insecure-requests` from the SPA's policy. Both depend on this value.
ENV NODE_ENV=production

# Mirrors the repository layout. The API resolves the SPA as
# `../../frontend/dist` relative to `backend/dist`, which is correct in the
# repository — so the image keeps that shape rather than flattening it.
WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /repo/backend/dist ./dist
COPY --from=build /repo/frontend/dist /app/frontend/dist

# `@printsync/shared-types` is deliberately absent. Every backend import of it is
# `import type`, which the compiler erases, so nothing is needed at runtime. If
# that ever stops being true this image fails at startup, loudly — which is the
# outcome to want, rather than a half-working process.
#
# No `.env` is copied either; the platform supplies configuration as environment
# variables, and `dotenv` does nothing when no file is present.

USER node
EXPOSE 4000

CMD ["node", "dist/server.js"]
