# Neon Auth Next.js Demos

A Next.js demo application showcasing authentication with **Neon Auth** (`@neondatabase/auth`). This app demonstrates how to integrate Neon's authentication system with a modern Next.js 15+ application.


## Getting Started

1. Clone this repository
2. Install dependencies:

```bash
bun install
```

3. Set up your environment variables:

```bash
cd examples/nextjs
cp .env.example .env
# Edit .env with your Neon Auth URL and Cookie secret
```

4. Run the development server:

```bash
bun run dev
```

5. Open [http://localhost:3000](http://localhost:3000) to see the app.

## Demos

- **`/`** – Marketing landing page
- **`/auth/sign-in`**, **`/auth/sign-up`** – Auth UI views (powered by `@neondatabase/auth/react/ui`)
- **`/dashboard`**, **`/notes`**, **`/account/*`** – Protected routes that require a session
- **`/iframe-test`** – Embeds the auth views in a same-origin iframe to verify that
  email/password and **OAuth (popup) flows work inside an iframe**

### Iframe / embedded auth

`@neondatabase/auth` automatically detects when your app is rendered inside an
`<iframe>` (via `globalThis.self !== globalThis.top`). When a user clicks a
social/SSO button from inside an iframe, the SDK opens the OAuth provider in a
popup window instead of attempting a top-level redirect (which OAuth providers
block via `X-Frame-Options` / CSP). After the OAuth callback completes, the
popup posts the session verifier back to the parent iframe via `postMessage`,
which finalises the session in the embedded context.

Visit `/iframe-test` to try this flow end-to-end. The same code paths apply
when this Next.js app is embedded as an iframe inside any third-party host
(embedded apps, widgets, multi-tenant platforms).

## Learn More

- [Neon Auth Documentation](https://neon.tech/docs/guides/neon-auth)
- [Neon Auth Nextjs Guide](https://neon.com/docs/auth/quick-start/nextjs)
