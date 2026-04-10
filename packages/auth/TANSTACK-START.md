# @neondatabase/auth/start

[![npm downloads](https://img.shields.io/npm/dm/@neondatabase/auth.svg)](https://www.npmjs.com/package/@neondatabase/auth)

A TanStack Start integration for **Neon Auth** (`@neondatabase/auth`). This guide demonstrates how to integrate Neon's authentication system with a TanStack Start application.

## Features

- 🔐 **Email OTP Authentication** - Passwordless login with email verification
- 🔗 **Social Login** - Google OAuth integration
- 👥 **Organizations** - Multi-tenant organization support
- 🎨 **Pre-built UI Components** - Beautiful, customizable auth views
- 🛡️ **Server-Side Auth** - Session validation in server functions via middleware
- 🌙 **Dark Mode Support** - Built-in theme support

## Setup Guide

### 1. Install the Package

```bash
npm install @neondatabase/auth
# or
pnpm add @neondatabase/auth
# or
yarn add @neondatabase/auth
```

### 2. Set Environment Variables

```bash
# .env

# Server-only — used by the auth server adapter for proxying requests,
# session validation, and cookie signing. Must NOT have the VITE_ prefix.
NEON_AUTH_URL=https://your-project.neonauth.region.aws.neon.tech/neondb/auth
NEON_AUTH_COOKIE_SECRET=your-secret-at-least-32-characters-long
```

Generate a secure cookie secret for production:

```bash
openssl rand -base64 32
```

**Note:** No `VITE_` prefixed auth URL is needed. The client SDK and UI components call your app's `/api/auth` proxy route (same origin), which forwards requests to the Neon Auth server. This keeps the auth server URL server-only.

#### Why `process.env` requires care in TanStack Start

TanStack Start runs all module-level code on both client and server. Accessing `process.env` at module scope will execute in the browser, leaking secrets or causing runtime errors. The adapter's deferred config callback ensures these variables are only read inside a server-side execution context. See the [TanStack Start execution model docs](https://tanstack.com/start/latest/docs/framework/react/guide/execution-model) for details.

### 3. Create the Auth Server Instance

The `createNeonAuth()` function provides a single entry point for all server-side functionality:

1. An auth route handler to proxy API calls from the frontend client
2. A function-level middleware to validate sessions in server functions
3. Auth APIs (getSession, token, etc.) for use in server functions

```typescript
// src/server/lib/auth.ts
import { createNeonAuth } from '@neondatabase/auth/start/server';

export const auth = createNeonAuth(() => ({
  baseUrl: process.env.NEON_AUTH_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
    sessionDataTtl: 300,       // Optional: session cache TTL in seconds (default: 300 = 5 min)
    domain: '.example.com',    // Optional: for cross-subdomain cookies
  },
}));
```

**Why a callback?** Because TanStack Start is isomorphic, this file will be evaluated on both client and server. If `createNeonAuth` took a config object directly, `process.env.NEON_AUTH_COOKIE_SECRET` would be accessed at module scope — leaking the secret into the client bundle or causing a runtime error. The callback defers access until the first server-side call, when `process.env` is safe to read.

### 4. Create the Auth Client

The client SDK sends auth requests to your app's `/api/auth` proxy route (not directly to the Neon Auth server):

```typescript
// src/integrations/auth/client.ts
import { createAuthClient } from '@neondatabase/auth/start';

export const authClient = createAuthClient();
```

### 5. Mount the Auth API Proxy Route

Create a catch-all server route to proxy auth requests to the Neon Auth server. This handles OAuth callbacks, session management, and cookie signing:

```typescript
// src/routes/api/auth/$.ts
import { createFileRoute } from '@tanstack/react-router';
import { auth } from '@/server/lib/auth';

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: auth.handler,
      POST: auth.handler,
    },
  },
});
```

### 6. Import CSS Styles

Choose the import method based on your project setup:

#### Option A: Without Tailwind CSS

If your project doesn't use Tailwind CSS, import the pre-built CSS bundle:

```typescript
// In your root route or app entry point
import '@neondatabase/auth/ui/css';
```

#### Option B: With Tailwind CSS

If your project uses Tailwind CSS v4, import the Tailwind-ready CSS:

```css
/* In your main CSS file (e.g., styles.css) */
@import 'tailwindcss';
@import '@neondatabase/auth/ui/tailwind';
```

### 7. Create Auth Pages

Create a route to render the auth UI views:

```tsx
// src/routes/auth/$pathname.tsx
import { AuthView } from '@neondatabase/auth/react/ui';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/auth/$pathname')({
  component: Auth,
});

function Auth() {
  const { pathname } = Route.useParams();
  return (
    <div className="flex justify-center items-center min-h-screen">
      <AuthView pathname={pathname} />
    </div>
  );
}
```

## Protecting Server Functions

Use `auth.middleware` to validate sessions and inject `context.auth` into server functions:

```typescript
import { createServerFn } from '@tanstack/react-start';
import { auth } from '@/server/lib/auth';

const getUser = createServerFn()
  .middleware([auth.middleware])
  .handler(async ({ context }) => {
    if (!context.auth.user) throw new Error('Not authenticated');
    return context.auth.user;
  });
```

The middleware provides `context.auth` with the shape `{ user, session }` when authenticated, or `{ user: null, session: null }` when not.

## Accessing Session Data

### Server Functions (via middleware)

```typescript
import { createServerFn } from '@tanstack/react-start';
import { auth } from '@/server/lib/auth';

const getDashboardData = createServerFn()
  .middleware([auth.middleware])
  .handler(async ({ context }) => {
    const { user, session } = context.auth;
    if (!user) throw new Error('Not authenticated');

    // Use user.id, user.email, user.name, etc.
    return {
      userName: user.name,
      userId: user.id,
      sessionExpires: session.expiresAt,
    };
  });
```

### Server Functions (direct session access)

For cases where you don't need middleware, call `auth.getSession()` directly:

```typescript
const checkSession = createServerFn().handler(async () => {
  const { data: session } = await auth.getSession();
  return session?.user ?? null;
});
```

### Client Components

Use the `authClient.useSession()` hook in React components:

```tsx
import { authClient } from '@/integrations/auth/client';

function UserInfo() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return <div>Loading...</div>;
  if (!session?.user) return <div>Not signed in</div>;

  return (
    <div>
      <h1>Welcome, {session.user.name}</h1>
      <p>User ID: {session.user.id}</p>
    </div>
  );
}
```

### Getting JWT Tokens

Retrieve a JWT token server-side for forwarding to downstream services:

```typescript
const callExternalApi = createServerFn()
  .middleware([auth.middleware])
  .handler(async ({ context }) => {
    if (!context.auth.user) throw new Error('Not authenticated');

    const { data: tokenData } = await auth.token();

    const response = await fetch('https://api.example.com/data', {
      headers: {
        Authorization: `Bearer ${tokenData.token}`,
      },
    });

    return response.json();
  });
```

## Available APIs

The `auth` instance provides access to all Neon Auth APIs:

- **Session**: `getSession()`, `listSessions()`, `revokeSession()`, `revokeOtherSessions()`
- **Token**: `token()`, `getAccessToken()`, `refreshToken()`
- **Auth**: `signIn.email()`, `signIn.social()`, `signIn.emailOtp()`, `signUp.email()`, `signOut()`
- **User**: `updateUser()`, `changePassword()`, `deleteUser()`, `sendVerificationEmail()`
- **Organization**: `organization.create()`, `organization.list()`, `organization.inviteMember()`, etc.
- **Admin**: `admin.listUsers()`, `admin.banUser()`, `admin.setRole()`, `admin.createUser()`, etc.
- **Email OTP**: `emailOtp.sendVerificationOtp()`, `emailOtp.verifyEmail()`

## Project Structure

```
src/
├── integrations/
│   └── auth/
│       └── client.ts           # Auth client instance
├── server/
│   └── lib/
│       └── auth.ts             # Auth server instance
├── routes/
│   ├── api/
│   │   └── auth/
│   │       └── $.ts            # Auth API proxy (catch-all)
│   ├── auth/
│   │   └── $pathname.tsx       # Auth views (sign-in, sign-up, etc.)
│   └── __root.tsx              # Root layout
└── styles.css                  # Global styles with Neon Auth CSS
```

## Key Differences from Next.js

| | Next.js | TanStack Start |
|---|---|---|
| **Config** | Direct object: `createNeonAuth({ ... })` | Deferred callback: `createNeonAuth(() => ({ ... }))` |
| **Handler** | `auth.handler()` returns `{ GET, POST }` | `auth.handler` is a function passed to `server.handlers` |
| **Middleware** | `auth.middleware()` for Next.js middleware | `auth.middleware` for `createServerFn().middleware([...])` |
| **Route protection** | Global via `middleware.ts` | Per-function via `.middleware([auth.middleware])` |
| **Auth API route** | `app/api/auth/[...path]/route.ts` | `src/routes/api/auth/$.ts` |
| **Env vars** | `process.env` in server files | `process.env` inside deferred callbacks only |

## Learn More

- [Neon Auth Documentation](https://neon.com/docs/guides/neon-auth)
- [TanStack Start Documentation](https://tanstack.com/start)
- [TanStack Router Documentation](https://tanstack.com/router)
- [Better Auth Session Management](https://www.better-auth.com/docs/concepts/session-management)
