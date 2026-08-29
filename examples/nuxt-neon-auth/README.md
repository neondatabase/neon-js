# Nuxt Neon Auth

A Nuxt 4 + Nuxt UI v4 version of `examples/nextjs-neon-auth`. It uses:

- `@neondatabase/auth/nuxt` for the Vue Better Auth client
- `@neondatabase/auth/nuxt/server` for the Nitro proxy, server methods and route middleware
- Nuxt `useFetch` for SSR data loading in the notes list
- Drizzle ORM with Neon serverless Postgres
- Nuxt UI for accessible forms, navigation, feedback and color mode

## Configure

Copy the environment template:

```bash
cp .env.example .env
```

Required values:

```dotenv
NUXT_NEON_AUTH_BASE_URL=https://your-neon-auth.example.com
NUXT_NEON_AUTH_COOKIE_SECRET=replace-with-at-least-32-random-characters
NUXT_DATABASE_URL=your-neon-database-url
```

Optional values:

```dotenv
NUXT_COOKIE_DOMAIN=.example.com
NUXT_PUBLIC_ADMIN_PORTAL_URL=https://admin.example.com
```

The admin link is rendered only when both the public URL is configured and the
signed-in user's global role is `admin`.

## Install and run

Run installation from the repository root so `workspace:*` resolves the local
auth package:

```bash
pnpm install
pnpm --filter nuxt-neon-auth db:push
pnpm --filter nuxt-neon-auth dev
```

The repository sets `ignore-scripts=true`, so the app scripts explicitly run
`nuxt prepare` before development, build, typecheck and lint tasks.

Other commands:

```bash
pnpm --filter nuxt-neon-auth build
pnpm --filter nuxt-neon-auth preview
pnpm --filter nuxt-neon-auth typecheck
pnpm --filter nuxt-neon-auth lint
pnpm --filter nuxt-neon-auth db:generate
pnpm --filter nuxt-neon-auth db:migrate
pnpm --filter nuxt-neon-auth db:studio
```

## Auth architecture

- `server/api/auth/[...path].ts` proxies same-origin `/api/auth/**` requests.
- `server/middleware/auth.ts` protects `/account`, `/organization` and `/notes`.
  It also lets the SDK process OAuth verifier callbacks on public routes.
- `server/utils/auth.ts` constructs auth from `useRuntimeConfig(event)` and binds
  server calls with `auth.withEvent(event)`.
- `app/middleware/auth.global.ts` covers client-side navigation. It deliberately
  skips SSR because Nitro middleware is authoritative there.
- `app/composables/useNeonAuth.ts` wraps Better Auth's reactive Vue
  `useSession` hook for shared client session state.

Enabled UI features match the Next.js example: email/password, name on sign-up,
Google and GitHub OAuth, email OTP, verification, password reset, organizations and the
`/dashboard` post-auth destination. Features that are not configured are omitted
from the UI.

## Notes

The notes schema matches the Next.js example. Every API reads the current
session and filters mutations by `session.user.id`.

Two create forms are included:

1. A Vue form that calls `POST /api/notes`.
2. A native HTML form that calls `POST /notes`.

The second route intentionally passes through auth middleware as a non-GET
request. It is the Nuxt equivalent of the Next.js Server Action regression case.

## Deploy

`nuxt.config.ts` selects Nitro's `node-server` preset. After building, run:

```bash
node .output/server/index.mjs
```

The multi-stage `Dockerfile` builds the local auth package and this workspace
then runs the standalone Nitro output as the unprivileged `node`
user. The root lockfile must include this example before using
`pnpm install --frozen-lockfile` in Docker.
