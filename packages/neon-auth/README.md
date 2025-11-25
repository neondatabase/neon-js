# @neondatabase/neon-auth

Authentication adapters for Neon Auth, supporting multiple auth providers.

## Overview

`@neondatabase/neon-auth` provides authentication adapters for applications using Neon Auth. It supports multiple auth providers through a unified adapter system:

- **SupabaseAdapter** - Supabase-compatible API for familiar auth patterns
- **BetterAuthVanillaAdapter** - Direct Better Auth API for vanilla JS/TS
- **BetterAuthReactAdapter** - Better Auth with React hooks support

This package is designed to work seamlessly with Neon's authentication infrastructure while providing:

- **Multiple adapter options** - Choose the API that fits your needs
- **Better Auth foundation** - Built on Better Auth's robust architecture
- **Performance optimizations** - Session caching and request deduplication
- **TypeScript support** - Fully typed with strict type checking

## Installation

```bash
npm install @neondatabase/neon-auth
# or
bun add @neondatabase/neon-auth
```

## Usage

### Using createNeonAuth (Recommended)

The `createNeonAuth` factory function creates an auth client with the appropriate adapter:

#### SupabaseAdapter - Supabase-compatible API

```typescript
import { createNeonAuth, SupabaseAdapter } from '@neondatabase/neon-auth';

const auth = createNeonAuth('https://your-auth-server.com', {
  adapter: SupabaseAdapter,
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
```

#### BetterAuthVanillaAdapter - Direct Better Auth API

```typescript
import { createNeonAuth, BetterAuthVanillaAdapter } from '@neondatabase/neon-auth';

const auth = createNeonAuth('https://your-auth-server.com', {
  adapter: BetterAuthVanillaAdapter,
});

// Direct Better Auth API
await auth.signUp.email({
  email: 'user@example.com',
  password: 'secure-password',
  name: 'John Doe',
});

await auth.signIn.email({
  email: 'user@example.com',
  password: 'secure-password',
});

const session = await auth.getSession();
await auth.signOut();
```

#### BetterAuthReactAdapter - Better Auth with React Hooks

```typescript
import { createNeonAuth, BetterAuthReactAdapter } from '@neondatabase/neon-auth';

const auth = createNeonAuth('https://your-auth-server.com', {
  adapter: BetterAuthReactAdapter,
});

// Direct Better Auth API
await auth.signIn.email({
  email: 'user@example.com',
  password: 'secure-password',
});

// React hooks
function MyComponent() {
  const session = auth.useSession();

  if (session.isPending) return <div>Loading...</div>;
  if (!session.data) return <div>Not logged in</div>;

  return <div>Hello, {session.data.user.name}</div>;
}
```

### OAuth Authentication (SupabaseAdapter)

```typescript
import { createNeonAuth, SupabaseAdapter } from '@neondatabase/neon-auth';

const auth = createNeonAuth('https://your-auth-server.com', {
  adapter: SupabaseAdapter,
});

await auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: '/dashboard',
  },
});
```

### OAuth Authentication (BetterAuth Adapters)

```typescript
import { createNeonAuth, BetterAuthVanillaAdapter } from '@neondatabase/neon-auth';

const auth = createNeonAuth('https://your-auth-server.com', {
  adapter: BetterAuthVanillaAdapter,
});

await auth.signIn.social({
  provider: 'google',
  callbackURL: '/dashboard',
});
```

## API Reference

### createNeonAuth(url, config)

Factory function to create an auth client.

**Parameters:**
- `url` - The auth service URL
- `config.adapter` - The adapter class to use
- `config.options` - Additional adapter-specific options

**Returns:** The adapter's public API (varies by adapter type)

### Adapters

#### SupabaseAdapter

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

#### BetterAuthVanillaAdapter / BetterAuthReactAdapter

Exposes the Better Auth client directly:

- `signIn.email(credentials)` - Sign in with email
- `signIn.social(options)` - Sign in with OAuth
- `signUp.email(credentials)` - Create new user
- `signOut()` - Sign out current user
- `getSession()` - Get current session

**React-specific (BetterAuthReactAdapter only):**
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

## TypeScript

Full TypeScript support with strict typing:

```typescript
import { createNeonAuth, SupabaseAdapter } from '@neondatabase/neon-auth';
import type { Session, User } from '@neondatabase/neon-auth';

const auth = createNeonAuth('https://your-auth-server.com', {
  adapter: SupabaseAdapter,
});

// Fully typed responses
const { data: session }: { data: Session | null } = await auth.getSession();
```

## Related Packages

- [`@neondatabase/neon-js`](../neon-js) - Full SDK with database and auth integration
- [`@neondatabase/postgrest-js`](../postgrest-js) - PostgreSQL client without auth

## Resources

- [Neon Auth Documentation](https://neon.tech/docs/neon-auth)
- [Better Auth Documentation](https://www.better-auth.com/docs)
- [Supabase Auth Reference](https://supabase.com/docs/reference/javascript/auth-signup)

## License

Apache-2.0
