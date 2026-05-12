# Neon Auth - Magic Link Example

Minimal passwordless authentication using email OTP (magic link) with [Neon Auth](https://neon.tech/docs/guides/neon-auth).

No passwords, no social providers, no organizations — just enter your email and get a one-time code.

## Setup

1. Install dependencies from the monorepo root:

```bash
bun install
```

2. Build workspace packages:

```bash
bun run build
```

3. Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

| Variable | Where to find it |
|----------|-----------------|
| `DATABASE_URL` | Neon Console > Connection Details |
| `NEON_AUTH_BASE_URL` | Neon Console > Project > Auth > Configuration |
| `NEON_AUTH_COOKIE_SECRET` | Generate with `openssl rand -base64 32` |

4. Run the app:

```bash
cd examples/neon-auth-magic-link-example
bun run dev
```

5. Open [http://localhost:3000](http://localhost:3000) and click "Sign in with Magic Link".

## How it works

- **Landing page** (`/`) — single button to sign in
- **Auth pages** (`/auth/*`) — handled by `@neondatabase/auth` UI components with `emailOTP` enabled
- **Dashboard** (`/dashboard`) — shows your email and session info after sign-in
- **API route** (`/api/auth/*`) — proxies auth requests to Neon Auth

The `emailOTP` prop on `NeonAuthUIProvider` enables passwordless email authentication. Users enter their email, receive a one-time code, and are signed in without ever setting a password.

## Webhooks

This example includes a webhook handler that receives events from Neon Auth and displays them in a live log.

### Endpoint

The app exposes `POST /api/webhooks/neon-auth` which receives webhook events from your Neon Auth instance. In local dev mode (when `NEON_AUTH_WEBHOOK_SECRET` is unset or `whsec_local_dev_secret`), signature verification is skipped.

### Configuring webhooks

In the Neon Console, go to **Project > Auth > Plugins** and add a webhook with:

- **URL**: Your app's webhook endpoint (see below for local dev)
- **Events**: `send.magic_link`, `user.created`, `user.before_create`, `user.updated`, `user.deleted`, `session.created`

### Local dev with Tilt

When running neon-auth in Docker via Tilt, use `host.docker.internal` so the container can reach your host machine:

```
https://host.docker.internal:<port>/api/webhooks/neon-auth
```

Replace `<port>` with the port your dev server is running on (e.g. `3000` or `3003`).

### Viewing events

Open [/webhooks](/webhooks) in your browser to see received webhook events in real time. The page polls every 2.5 seconds and displays events with expandable JSON payloads.
