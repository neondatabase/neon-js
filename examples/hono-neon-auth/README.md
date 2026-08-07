# hono-neon-auth

Minimal example of the `@neondatabase/auth/hono/server` adapter — a Hono app with the Neon Auth proxy mounted at `/api/auth/*`, route protection via `auth.middleware()`, and a protected `/dashboard` route that reads the session via `auth.getSession()`.

## Setup

```bash
pnpm install
cp .env.example .env
# edit .env to point NEON_AUTH_BASE_URL at your Neon Auth instance
# and set NEON_AUTH_COOKIE_SECRET (min 32 chars)
```

## Run

```bash
pnpm dev     # tsx watch — restarts on changes
pnpm start   # one-off
```

The server listens on `http://localhost:3000` by default (override with `PORT`).

## What to look at

- **`src/auth.ts`** — the `createNeonAuth({ baseUrl, cookies })` singleton.
- **`src/index.ts`** — the Hono app, showing the three mandatory wires:
  1. `app.use(contextStorage())` — required by the Hono adapter so `auth.getSession()` can resolve the in-flight request.
  2. `app.on(['GET','POST'], '/api/auth/*', auth.handler())` — the proxy mount.
  3. `app.use('*', auth.middleware({ loginUrl: '/sign-in' }))` — route protection.

For the full Hono adapter walkthrough see [`packages/auth/BUILDING-AN-ADAPTER.md`](../../packages/auth/BUILDING-AN-ADAPTER.md).
