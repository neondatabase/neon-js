# TanStack Start Integration Guide

This guide covers how to integrate Neon Auth with [TanStack Start](https://tanstack.com/start) applications.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Usage](#usage)
  - [Server-Side Auth](#server-side-auth)
  - [Client-Side Auth](#client-side-auth)
  - [Route Protection](#route-protection)
  - [Auth UI Components](#auth-ui-components)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Comparison with Next.js](#comparison-with-nextjs)

---

## Installation

```bash
npm install @neondatabase/auth @tanstack/react-start @tanstack/react-router
# or
bun add @neondatabase/auth @tanstack/react-start @tanstack/react-router
```

### Required Peer Dependencies

- `@tanstack/react-start` >= 1.0.0
- `@tanstack/react-router` >= 1.0.0
- `react` >= 18.0.0
- `react-dom` >= 18.0.0

---

## Quick Start

### 1. Environment Variables

Create a `.env` file:

```bash
NEON_AUTH_BASE_URL=https://your-auth-server.com
NEON_AUTH_COOKIE_SECRET=your-secret-key-min-32-characters-long
```

### 2. Server-Side Auth Setup

Create a server auth instance:

```typescript
// app/lib/auth-server.ts
import { createNeonAuth } from '@neondatabase/auth/tanstack/start/server';

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
    sessionDataTtl: 300, // 5 minutes (optional, default: 300)
  },
});
```

### 3. Export Server Functions

TanStack Start requires explicit server function exports:

```typescript
// app/api.ts
import { createServerFn } from '@tanstack/react-start';
import { auth } from './lib/auth-server';

// Auth API handler (called by client SDK)
export const authHandler = createServerFn({ method: 'POST' })
  .handler(auth.handler());

// Export auth methods as server functions (optional, for direct use)
export const getSession = createServerFn({ method: 'GET' })
  .handler(() => auth.getSession());

export const signOut = createServerFn({ method: 'POST' })
  .handler(() => auth.signOut());
```

### 4. Client-Side Auth Setup

Create a client auth instance:

```typescript
// app/lib/auth-client.ts
'use client';
import { createAuthClient } from '@neondatabase/auth/tanstack/start';

export const authClient = createAuthClient();
```

### 5. Protect Routes

Create a protected route group:

```typescript
// app/routes/_authed.tsx
import { createFileRoute } from '@tanstack/react-router';
import { auth } from '@/lib/auth-server';

export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ location }) => {
    await auth.protectRoute({
      pathname: location.pathname,
      loginUrl: '/auth/sign-in',
    });
  },
});
```

All routes under `_authed/` are now protected!

---

## Configuration

### `createNeonAuth(config)`

**Server-Side Configuration:**

```typescript
import { createNeonAuth } from '@neondatabase/auth/tanstack/start/server';

const auth = createNeonAuth({
  baseUrl: 'https://your-auth-server.com',  // Required
  cookies: {
    secret: 'your-secret-key',               // Required (min 32 chars)
    sessionDataTtl: 300,                     // Optional (default: 300 seconds)
    domain: '.example.com',                  // Optional (for cross-subdomain)
  },
});
```

**Options:**

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `baseUrl` | `string` | ✅ | - | Base URL of your Neon Auth instance |
| `cookies.secret` | `string` | ✅ | - | Secret for signing cookies (min 32 characters) |
| `cookies.sessionDataTtl` | `number` | ❌ | `300` | Session cache TTL in seconds |
| `cookies.domain` | `string` | ❌ | current | Cookie domain (use `.example.com` for subdomains) |

---

## Usage

### Server-Side Auth

The `auth` object provides all Better Auth server methods automatically via proxy pattern.

#### In Route Loaders

```typescript
// app/routes/_authed/dashboard.tsx
import { createFileRoute, redirect } from '@tanstack/react-router';
import { auth } from '@/lib/auth-server';

export const Route = createFileRoute('/_authed/dashboard')({
  loader: async () => {
    const { data: session } = await auth.getSession();

    if (!session?.user) {
      throw redirect({ to: '/auth/sign-in' });
    }

    return { user: session.user };
  },
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useLoaderData();
  return <div>Hello {user.name}</div>;
}
```

#### In Server Functions

```typescript
// app/api.ts
import { createServerFn } from '@tanstack/react-start';
import { auth } from './lib/auth-server';

export const updateProfile = createServerFn({ method: 'POST' })
  .handler(async ({ data }) => {
    // Verify session
    const { data: session } = await auth.getSession();
    if (!session?.user) {
      throw new Error('Unauthorized');
    }

    // Update user profile
    const { data: updated } = await auth.updateUser({
      name: data.name,
      image: data.image,
    });

    return updated;
  });
```

#### Available Auth Methods

All Better Auth methods are available:

```typescript
// Session
await auth.getSession();

// Sign In
await auth.signIn.email({ email, password });
await auth.signIn.social({ provider: 'github' });

// Sign Up
await auth.signUp.email({ email, password, name });

// Sign Out
await auth.signOut();

// User Management
await auth.updateUser({ name, image });
await auth.user.changePassword({ currentPassword, newPassword });

// Organization Management (if enabled)
await auth.organization.create({ name });
await auth.organization.list();

// Admin Operations (if enabled)
await auth.admin.listUsers();
await auth.admin.impersonateUser({ userId });

// And more...
```

### Client-Side Auth

#### With React Hooks

```typescript
// components/UserMenu.tsx
import { authClient } from '@/lib/auth-client';

export function UserMenu() {
  const session = authClient.useSession();

  if (session.isPending) {
    return <div>Loading...</div>;
  }

  if (!session.data) {
    return <LoginButton />;
  }

  return (
    <div>
      <span>Hello {session.data.user.name}</span>
      <button onClick={() => authClient.signOut()}>
        Sign Out
      </button>
    </div>
  );
}
```

#### Calling Server Functions

```typescript
// components/ProfileForm.tsx
import { useServerFn } from '@tanstack/start';
import { updateProfile } from '@/api';

export function ProfileForm() {
  const update = useServerFn(updateProfile);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    await update({
      data: {
        name: formData.get('name'),
        image: formData.get('image'),
      },
    });
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### Route Protection

#### Protected Route Group

```typescript
// app/routes/_authed.tsx
import { createFileRoute } from '@tanstack/react-router';
import { auth } from '@/lib/auth-server';

export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ location }) => {
    await auth.protectRoute({
      pathname: location.pathname,
      loginUrl: '/auth/sign-in',
    });
  },
});
```

All child routes under `_authed/` are now protected:
- `_authed/dashboard.tsx` → `/dashboard` (protected)
- `_authed/settings.tsx` → `/settings` (protected)
- `_authed/profile.tsx` → `/profile` (protected)

#### Individual Route Protection

For finer-grained control:

```typescript
// app/routes/admin.tsx
import { createFileRoute, redirect } from '@tanstack/react-router';
import { auth } from '@/lib/auth-server';

export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ location }) => {
    const { data: session } = await auth.getSession();

    // Custom logic: check for admin role
    if (!session?.user || session.user.role !== 'admin') {
      throw redirect({ to: '/unauthorized' });
    }
  },
});
```

### Auth UI Components

#### Using Pre-Built Components

```typescript
// app/routes/auth/sign-in.tsx
import { createFileRoute } from '@tanstack/react-router';
import { NeonAuthUIProvider, SignInForm } from '@neondatabase/auth-ui';
import { authClient } from '@/lib/auth-client';

export const Route = createFileRoute('/auth/sign-in')({
  component: SignIn,
});

function SignIn() {
  return (
    <NeonAuthUIProvider authClient={authClient} redirectTo="/dashboard">
      <SignInForm />
    </NeonAuthUIProvider>
  );
}
```

#### Import CSS

**Without Tailwind:**
```css
/* app/styles.css */
@import '@neondatabase/auth/ui/css';
```

**With Tailwind CSS v4:**
```css
/* app/styles.css */
@import 'tailwindcss';
@import '@neondatabase/auth/ui/tailwind';
```

#### Available Components

```typescript
import {
  NeonAuthUIProvider,
  SignInForm,
  SignUpForm,
  UserButton,
  MagicLinkForm,
  EmailOTPForm,
  ForgotPasswordForm,
  ResetPasswordForm,
} from '@neondatabase/auth-ui';
```

---

## API Reference

### Server-Side

#### `createNeonAuth(config)`

Creates a Neon Auth instance for server-side use.

**Returns:** `NeonAuth` object with:
- All Better Auth methods (via Proxy)
- `handler()` - Returns auth API handler
- `protectRoute(config)` - Route protection helper

#### `auth.handler()`

Returns a handler function for use with `createServerFn()`.

**Example:**
```typescript
export const authHandler = createServerFn({ method: 'POST' })
  .handler(auth.handler());
```

#### `auth.protectRoute(config)`

Protects a route from unauthenticated access.

**Parameters:**
- `config.pathname` - Current pathname
- `config.loginUrl` - Redirect URL for unauthenticated users (default: `/auth/sign-in`)

**Throws:** `redirect()` if authentication fails

### Client-Side

#### `createAuthClient()`

Creates a Neon Auth client for client-side use.

**Returns:** Auth client with:
- `useSession()` - React hook for session state
- All Better Auth client methods
- Automatic proxy to server handler

---

## Examples

### Complete Auth Flow

#### 1. Sign Up Page

```typescript
// app/routes/auth/sign-up.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { NeonAuthUIProvider, SignUpForm } from '@neondatabase/auth-ui';
import { authClient } from '@/lib/auth-client';

export const Route = createFileRoute('/auth/sign-up')({
  component: SignUp,
});

function SignUp() {
  return (
    <NeonAuthUIProvider authClient={authClient} redirectTo="/dashboard">
      <SignUpForm />
    </NeonAuthUIProvider>
  );
}
```

#### 2. Sign In Page

```typescript
// app/routes/auth/sign-in.tsx
import { createFileRoute } from '@tanstack/react-router';
import { NeonAuthUIProvider, SignInForm } from '@neondatabase/auth-ui';
import { authClient } from '@/lib/auth-client';

export const Route = createFileRoute('/auth/sign-in')({
  component: SignIn,
});

function SignIn() {
  return (
    <NeonAuthUIProvider authClient={authClient} redirectTo="/dashboard">
      <SignInForm />
    </NeonAuthUIProvider>
  );
}
```

#### 3. Protected Dashboard

```typescript
// app/routes/_authed/dashboard.tsx
import { createFileRoute } from '@tanstack/react-router';
import { auth } from '@/lib/auth-server';
import { authClient } from '@/lib/auth-client';

export const Route = createFileRoute('/_authed/dashboard')({
  loader: async () => {
    const { data: session } = await auth.getSession();
    return { user: session?.user };
  },
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useLoaderData();
  const session = authClient.useSession();

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome, {user.name}</p>
      <button onClick={() => authClient.signOut()}>
        Sign Out
      </button>
    </div>
  );
}
```

### OAuth Integration

```typescript
// components/OAuthButtons.tsx
import { authClient } from '@/lib/auth-client';

export function OAuthButtons() {
  const handleGitHubSignIn = async () => {
    await authClient.signIn.social({ provider: 'github' });
  };

  const handleGoogleSignIn = async () => {
    await authClient.signIn.social({ provider: 'google' });
  };

  return (
    <div>
      <button onClick={handleGitHubSignIn}>
        Sign in with GitHub
      </button>
      <button onClick={handleGoogleSignIn}>
        Sign in with Google
      </button>
    </div>
  );
}
```

---

## Comparison with Next.js

TanStack Start and Next.js have different architectural patterns for auth:

| Feature | Next.js | TanStack Start |
|---------|---------|----------------|
| **Server Auth Instance** | `createNeonAuth()` | `createNeonAuth()` (same) |
| **Client Auth Instance** | `createAuthClient()` | `createAuthClient()` (same) |
| **Auth Methods** | All methods available | All methods available (same) |
| **API Handler** | Route Handler (`/api/auth/[...path]/route.ts`) | Server Function (`createServerFn`) |
| **Middleware** | Global `middleware.ts` | Per-route `beforeLoad` |
| **Route Protection** | `auth.middleware()` | `auth.protectRoute()` |
| **Session Access** | Server Components, Actions, Loaders | Loaders, Server Functions |
| **Cookies** | Automatic via `next/headers` | Automatic via TanStack context |

### Key Differences

#### API Handler Setup

**Next.js:**
```typescript
// app/api/auth/[...path]/route.ts
export const { GET, POST } = auth.handler();
```

**TanStack Start:**
```typescript
// app/api.ts
import { createServerFn } from '@tanstack/react-start';

export const authHandler = createServerFn({ method: 'POST' })
  .handler(auth.handler());
```

#### Route Protection

**Next.js (Global):**
```typescript
// middleware.ts
export default auth.middleware({ loginUrl: '/auth/sign-in' });
```

**TanStack Start (Per-Route):**
```typescript
// routes/_authed.tsx
beforeLoad: async ({ location }) => {
  await auth.protectRoute({ pathname: location.pathname });
}
```

#### Session Access

**Next.js:**
```typescript
// Server Component
export default async function Page() {
  const { data: session } = await auth.getSession();
}
```

**TanStack Start:**
```typescript
// Route Loader
export const Route = createFileRoute('/page')({
  loader: async () => {
    const { data: session } = await auth.getSession();
    return { session };
  },
});
```

### Why These Differences?

- **TanStack Start** doesn't have global middleware - protection is route-based
- **TanStack Start** uses explicit server functions instead of implicit API routes
- Both achieve the same security and functionality, just different patterns

---

## Troubleshooting

### "No StartEvent found in AsyncLocalStorage"

This error means you're trying to access request context outside of a server function or loader.

**Solution:** Only call `auth` methods within:
- Route loaders
- `beforeLoad` hooks
- Server functions (`createServerFn`)

### Session Not Persisting

Ensure your cookie secret is at least 32 characters:

```typescript
// ❌ BAD
cookies: { secret: 'short' }

// ✅ GOOD
cookies: { secret: 'a-very-long-secret-key-at-least-32-characters-long' }
```

### TypeScript Errors on `auth` Methods

Make sure you have the correct peer dependencies installed:

```bash
bun add @tanstack/react-start @tanstack/react-router
```

---

## Additional Resources

- [TanStack Start Documentation](https://tanstack.com/start/docs)
- [Better Auth Documentation](https://www.better-auth.com/docs)
- [Neon Auth UI Components](../auth-ui/README.md)
- [Example Application](../../examples/tanstack-start-neon-auth/)

---

## Support

- [GitHub Issues](https://github.com/neondatabase/neon-js/issues)
- [Neon Discord](https://neon.tech/discord)
