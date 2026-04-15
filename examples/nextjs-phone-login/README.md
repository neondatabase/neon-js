# Phone Number Login Example

Minimal example demonstrating phone number OTP sign-in with [Neon Auth](https://neon.tech/docs/guides/neon-auth).

Users can sign up with email or Google OAuth, then sign in using their phone number via OTP. Includes a live webhook event viewer.

## Features

- **Email + Google OAuth** sign-up/sign-in via Neon Auth
- **Phone number OTP** sign-in (send code → verify)
- **Dashboard** showing authenticated user info and session details
- **Webhook viewer** (public, no auth required) — polls for live Neon Auth webhook events with color-coded badges and expandable payloads

## Prerequisites

- Node.js 18+
- A [Neon](https://neon.tech) project with Neon Auth enabled
- Phone number plugin enabled on your Neon Auth instance

## Setup

1. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

2. Fill in your `.env`:
   ```
   NEON_AUTH_BASE_URL=https://ep-xxx.neonauth.us-east-1.aws.neon.tech/neondb/auth
   DATABASE_URL=postgresql://...
   NEON_AUTH_COOKIE_SECRET=<random string, at least 32 characters>
   ```

   You can find `NEON_AUTH_BASE_URL` in the Neon Console under **Project → Auth → Configuration**.
   Generate a cookie secret with: `openssl rand -base64 32`

3. Push the database schema:
   ```bash
   bun db:push
   ```

4. Start the dev server:
   ```bash
   bun dev
   ```

5. Open [https://localhost:3000](https://localhost:3000) (uses `--experimental-https` for self-signed TLS)

## Webhook Setup

This example includes a webhook endpoint and a live event viewer. To receive webhook events from Neon Auth:

1. **Configure the webhook URL** in the Neon Console under **Project → Auth → Webhooks**:
   ```
   https://<your-deployed-domain>/api/webhooks/neon-auth
   ```

2. **Select events** to subscribe to. Recommended for this example:
   - `user.before_create` — fires before user creation (blocking)
   - `user.created` — fires after user creation
   - `send.otp` — fires when an OTP is sent
   - `send.magic_link` — fires when a magic link is sent
   - `phone_number.verified` — fires when a phone number is verified

3. **View events** at `/webhooks` in the app. Events appear in real-time with color-coded badges, expandable JSON payloads, and type summaries.

### Webhook Signature Verification

In production, the webhook endpoint verifies EdDSA (Ed25519) JWS signatures using the JWKS endpoint on your Neon Auth instance. This ensures webhook payloads are authentic and haven't been tampered with.

In local development, signature verification is skipped when `NEON_AUTH_WEBHOOK_SECRET` is unset or set to `whsec_local_dev_secret`.

## Local Development (with local neon-js)

This example uses `workspace:*` to link against the local `@neondatabase/auth` package. To develop with unreleased features (e.g., the phone number client plugin):

```bash
# From the neon-js repo root
bun install
bun run build          # Build all packages
cd examples/nextjs-phone-login
bun dev
```

## Project Structure

```
app/
├── api/
│   ├── auth/[...path]/route.ts      # Neon Auth handler
│   └── webhooks/
│       ├── neon-auth/route.ts        # Webhook ingest (JWS verification)
│       └── events/route.ts           # Read/clear stored events
├── auth/[path]/page.tsx              # Sign-in, sign-up views
├── dashboard/page.tsx                # Protected — user info + phone OTP
├── webhooks/page.tsx                 # Public — live event viewer
├── layout.tsx
├── page.tsx                          # Landing page
└── providers.tsx                     # NeonAuthUIProvider config
components/
└── phone-login-form.tsx              # Phone OTP send/verify form
lib/
├── auth/client.ts                    # Client-side auth
├── auth/server.ts                    # Server-side auth
├── db.ts                             # Drizzle + Neon serverless
├── schema.ts                         # DB schema (empty — Neon Auth manages its own)
└── webhook-store.ts                  # In-memory event store
```
