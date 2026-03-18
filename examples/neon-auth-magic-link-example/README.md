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
