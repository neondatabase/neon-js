# @neondatabase/auth

[![npm version](https://img.shields.io/npm/v/@neondatabase/auth.svg)](https://www.npmjs.com/package/@neondatabase/auth)
[![npm downloads](https://img.shields.io/npm/dm/@neondatabase/auth.svg)](https://www.npmjs.com/package/@neondatabase/auth)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/npm/l/@neondatabase/auth.svg)](https://github.com/neondatabase-labs/neon-js/blob/main/LICENSE)

Authentication adapters for Neon Auth, supporting multiple auth providers.

## Overview

`@neondatabase/auth` provides authentication for applications using Neon Auth. By default, it uses the Better Auth API, with optional adapters for different API styles:

- **Default** - Better Auth API (`signIn.email`, `signUp.email`, etc.)
- **SupabaseAuthAdapter** - Supabase-compatible API for migrations (`signInWithPassword`, `signUp`, etc.)
- **BetterAuthReactAdapter** - Better Auth with React hooks (`useSession`)

This package is designed to work seamlessly with Neon's authentication infrastructure while providing:

- **Simple default API** - Works out of the box with Better Auth patterns
- **Optional adapters** - Switch API styles for migrations or preferences
- **Anonymous access** - Optional RLS-based data access for unauthenticated users
- **Performance optimizations** - Session caching and request deduplication
- **TypeScript support** - Fully typed with strict type checking

## Installation

```bash
npm install @neondatabase/auth
# or
bun add @neondatabase/auth
```

## Usage

### Basic Usage (Default)

The `createAuthClient` factory function creates an auth client. By default, it uses the Better Auth API:

```typescript
import { createAuthClient } from '@neondatabase/auth';

const auth = createAuthClient('https://your-auth-server.com');

// Sign up
await auth.signUp.email({
  email: 'user@example.com',
  password: 'secure-password',
  name: 'John Doe',
});

// Sign in
await auth.signIn.email({
  email: 'user@example.com',
  password: 'secure-password',
});

// Get session
const session = await auth.getSession();

// Sign out
await auth.signOut();
```

### OAuth Authentication

```typescript
import { createAuthClient } from '@neondatabase/auth';

const auth = createAuthClient('https://your-auth-server.com');

await auth.signIn.social({
  provider: 'google',
  callbackURL: '/dashboard',
});
```

## Using Adapters

You can optionally specify an adapter to change the API style. This is useful for migrations or if you prefer a different API.

### SupabaseAuthAdapter - Supabase-compatible API

Use this adapter if you're migrating from Supabase or prefer the Supabase API style:

```typescript
import { createAuthClient, SupabaseAuthAdapter } from '@neondatabase/auth';

const auth = createAuthClient('https://your-auth-server.com', {
  adapter: SupabaseAuthAdapter(),
});

// Supabase-compatible methods
await auth.signUp({
  email: 'user@example.com',
  password: 'secure-password',
  options: {
    data: { name: 'John Doe' },
  },
});

await auth.signInWithPassword({
  email: 'user@example.com',
  password: 'secure-password',
});

const { data: session } = await auth.getSession();
await auth.signOut();

// OAuth with Supabase-style API
await auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: '/dashboard',
  },
});
```

### BetterAuthReactAdapter - React Hooks Support

Use this adapter in React applications to get access to hooks like `useSession`:

```typescript
import { createAuthClient } from '@neondatabase/auth';
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters';

const auth = createAuthClient('https://your-auth-server.com', {
  adapter: BetterAuthReactAdapter(),
});

// Same API as default
await auth.signIn.email({
  email: 'user@example.com',
  password: 'secure-password',
});

// Plus React hooks
function MyComponent() {
  const session = auth.useSession();

  if (session.isPending) return <div>Loading...</div>;
  if (!session.data) return <div>Not logged in</div>;

  return <div>Hello, {session.data.user.name}</div>;
}
```

## Anonymous Access

Enable `allowAnonymous` to let unauthenticated users access data via RLS policies:

```typescript
import { createAuthClient } from '@neondatabase/auth';

const auth = createAuthClient('https://your-auth-server.com', {
  allowAnonymous: true, // Enable anonymous data access
});

// Get token - returns anonymous token if no user session exists
const token = await auth.getJWTToken?.();
```

This is useful when you want to allow read-only public access to certain data while still enforcing RLS policies.

## API Reference

### createAuthClient(url, config?)

Factory function to create an auth client.

**Parameters:**
- `url` - The auth service URL (required)
- `config.adapter` - Optional adapter factory function (e.g., `SupabaseAuthAdapter()`)
- `config.allowAnonymous` - When `true`, returns an anonymous token if no user session exists (default: `false`)

**Returns:** The adapter's public API (varies by adapter type)

### Default API (Better Auth)

- `signIn.email(credentials)` - Sign in with email
- `signIn.social(options)` - Sign in with OAuth
- `signUp.email(credentials)` - Create new user
- `signOut()` - Sign out current user
- `getSession()` - Get current session

### SupabaseAuthAdapter API

Provides a Supabase-compatible API:

- `signUp(credentials)` - Create a new user
- `signInWithPassword(credentials)` - Sign in with email/password
- `signInWithOAuth(options)` - Sign in with OAuth provider
- `signOut()` - Sign out current user
- `getSession()` - Get current session
- `getUser()` - Get current user
- `updateUser(attributes)` - Update user metadata
- `getUserIdentities()` - Get linked OAuth identities
- `linkIdentity(credentials)` - Link OAuth provider
- `unlinkIdentity(identity)` - Unlink OAuth provider
- `resetPasswordForEmail(email, options)` - Send password reset
- `onAuthStateChange(callback)` - Listen to auth state changes

### BetterAuthReactAdapter API

Same as default API, plus:

- `useSession()` - React hook for session state

## Performance Features

### Session Caching

Sessions are cached in memory with intelligent TTL management:
- 60-second default cache TTL
- Automatic expiration based on JWT `exp` claim
- Lazy expiration checking on reads
- Synchronous cache clearing on sign-out

### Request Deduplication

Multiple concurrent `getSession()` calls are automatically deduplicated:
- Single network request for concurrent calls
- 10x faster cold starts (10 concurrent calls: ~2000ms → ~200ms)
- Reduces server load by N-1 for N concurrent calls

## Environment Compatibility

- Node.js 14+
- Browser (all modern browsers)
- Edge Runtime (Vercel, Cloudflare Workers, etc.)
- Bun

## Next.js Integration

For Next.js projects, this package provides built-in integration via `@neondatabase/auth/next`. See the [Next.js Setup Guide](./NEXT-JS.md) for:

- Setting up the auth handler with `authApiHandler()`
- Protecting routes with `neonAuthMiddleware()`
- Creating the auth client with `createAuthClient()` for client components
- Configuring the `NeonAuthUIProvider` with Email OTP, Social Login, and Organizations
- Creating auth pages (`AuthView`, `AccountView`, `OrganizationView`)
- Importing styles (with or without Tailwind CSS)
- Accessing session data with `neonAuth()` in server components
- Using `authClient.useSession()` hook in client components

## CSS for UI Components

Styles for Neon Auth UI components are available from this package:

| Export | Use Case |
|--------|----------|
| `@neondatabase/auth/ui/css` | Pre-built styles (~47KB) |
| `@neondatabase/auth/ui/tailwind` | Tailwind-ready CSS |

```css
/* Without Tailwind */
@import '@neondatabase/auth/ui/css';

/* With Tailwind CSS v4 */
@import 'tailwindcss';
@import '@neondatabase/auth/ui/tailwind';
```

## Related Packages

- [`@neondatabase/neon-js`](../neon-js) - Full SDK with database and auth integration
- [`@neondatabase/postgrest-js`](../postgrest-js) - PostgreSQL client without auth

## Resources

- [Neon Auth Documentation](https://neon.tech/docs/neon-auth)
- [Better Auth Documentation](https://www.better-auth.com/docs)

## Support

- [GitHub Issues](https://github.com/neondatabase/neon-js/issues)
- [Neon Community Discord](https://discord.gg/H24eC2UN)

## License

Apache-2.0
