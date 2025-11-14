# @neondatabase/auth

Supabase-compatible authentication adapter for Neon Auth, built on Better Auth.

## Overview

`@neondatabase/auth` provides a Supabase-compatible authentication client for applications using Neon Auth. It's a wrapper on top of [Better Auth](https://www.better-auth.com) that implements the Supabase `AuthClient` interface, making it easy to migrate from Supabase or use familiar authentication patterns.

This package is designed to work seamlessly with Neon's authentication infrastructure while providing:

- **Supabase API compatibility** - Drop-in replacement for Supabase auth
- **Better Auth features** - Built on Better Auth's robust foundation
- **Performance optimizations** - Session caching, request deduplication, and cross-tab sync
- **TypeScript support** - Fully typed with strict type checking

## Installation

```bash
npm install @neondatabase/auth
# or
bun add @neondatabase/auth
```

## Usage

### Basic Setup

```typescript
import { BetterAuthAdapter } from '@neondatabase/auth/better-auth';

const auth = new BetterAuthAdapter({
  baseURL: 'https://your-auth-server.com',
});

// Sign up
await auth.signUp({
  email: 'user@example.com',
  password: 'secure-password',
  options: {
    data: {
      name: 'John Doe',
    },
  },
});

// Sign in
await auth.signInWithPassword({
  email: 'user@example.com',
  password: 'secure-password',
});

// Get current session
const { data: session } = await auth.getSession();
console.log(session?.user);

// Sign out
await auth.signOut();
```

### OAuth Authentication

```typescript
// Sign in with OAuth provider
await auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: '/dashboard',
  },
});
```

### Session Management

```typescript
// Get current session (cached for performance)
const { data: session } = await auth.getSession();

// Get current user
const { data: user } = await auth.getUser();

// Update user metadata
await auth.updateUser({
  data: {
    name: 'Jane Doe',
    avatar_url: 'https://example.com/avatar.jpg',
  },
});
```

### Auth State Changes

Listen to authentication state changes across your application:

```typescript
const { data: subscription } = auth.onAuthStateChange((event, session) => {
  console.log('Auth event:', event);

  switch (event) {
    case 'SIGNED_IN':
      console.log('User signed in:', session?.user);
      break;
    case 'SIGNED_OUT':
      console.log('User signed out');
      break;
    case 'TOKEN_REFRESHED':
      console.log('Token refreshed');
      break;
    case 'USER_UPDATED':
      console.log('User updated:', session?.user);
      break;
  }
});

// Cleanup when done
subscription.unsubscribe();
```

## API Reference

### Authentication Methods

#### `signUp(credentials)`

Create a new user account.

```typescript
await auth.signUp({
  email: 'user@example.com',
  password: 'secure-password',
  options: {
    data: {
      name: 'John Doe',
      // ... additional metadata
    },
  },
});
```

#### `signInWithPassword(credentials)`

Sign in with email and password.

```typescript
await auth.signInWithPassword({
  email: 'user@example.com',
  password: 'secure-password',
});
```

#### `signInWithOAuth(options)`

Sign in with an OAuth provider.

```typescript
await auth.signInWithOAuth({
  provider: 'google', // or 'github', 'apple', etc.
  options: {
    redirectTo: '/dashboard',
  },
});
```

#### `signOut()`

Sign out the current user.

```typescript
await auth.signOut();
```

### Session Methods

#### `getSession()`

Get the current session (cached for performance).

```typescript
const { data: session, error } = await auth.getSession();
```

#### `getUser()`

Get the current user.

```typescript
const { data: user, error } = await auth.getUser();
```

### User Management

#### `updateUser(attributes)`

Update user metadata.

```typescript
await auth.updateUser({
  data: {
    name: 'Jane Doe',
    avatar_url: 'https://example.com/avatar.jpg',
  },
});
```

#### `getUserIdentities()`

Get linked OAuth identities.

```typescript
const { data: identities } = await auth.getUserIdentities();
```

#### `linkIdentity(credentials)`

Link a new OAuth provider to the current user.

```typescript
await auth.linkIdentity({
  provider: 'github',
});
```

#### `unlinkIdentity(identity)`

Unlink an OAuth provider.

```typescript
await auth.unlinkIdentity({
  identity: {
    id: 'identity-id',
    provider: 'github',
  },
});
```

### Password Management

#### `resetPasswordForEmail(email)`

Send a password reset email.

```typescript
await auth.resetPasswordForEmail('user@example.com', {
  redirectTo: '/reset-password',
});
```

### Event Listeners

#### `onAuthStateChange(callback)`

Listen to authentication state changes.

```typescript
const { data: subscription } = auth.onAuthStateChange((event, session) => {
  // Handle auth state change
});
```

**Events:**
- `SIGNED_IN` - User signed in
- `SIGNED_OUT` - User signed out
- `TOKEN_REFRESHED` - Access token refreshed
- `USER_UPDATED` - User metadata updated

## Performance Features

### Session Caching

Sessions are cached in memory with intelligent TTL management:
- 60-second default cache TTL
- Automatic expiration based on JWT `exp` claim
- Lazy expiration checking on reads
- Synchronous cache clearing on sign-out

**Result:** Sub-millisecond session reads after initial fetch.

### Request Deduplication

Multiple concurrent `getSession()` calls are automatically deduplicated:
- Single network request for concurrent calls
- 10x faster cold starts (10 concurrent calls: ~2000ms ’ ~200ms)
- Reduces server load by N-1 for N concurrent calls

### Cross-Tab Synchronization

Authentication state syncs across browser tabs (browser only):
- Automatic sync via BroadcastChannel API
- <50ms latency for cross-tab updates
- Sign out in one tab, all tabs update instantly

## Environment Compatibility

-  Node.js 14+
-  Browser (all modern browsers)
-  Edge Runtime (Vercel, Cloudflare Workers, etc.)
-  Bun

**Note:** Cross-tab sync is browser-only. Other features work in all environments.

## TypeScript

Full TypeScript support with strict typing:

```typescript
import type { AuthClient, Session, User } from '@neondatabase/auth';

const auth: AuthClient = new BetterAuthAdapter({
  baseURL: 'https://your-auth-server.com',
});

// Fully typed responses
const { data: session }: { data: Session | null } = await auth.getSession();
const { data: user }: { data: User | null } = await auth.getUser();
```

## Supabase Compatibility

This package implements the Supabase `AuthClient` interface, making it compatible with Supabase's authentication API. If you're migrating from Supabase, most of your existing auth code will work without changes.

### Key Differences

While the API is Supabase-compatible, the underlying implementation uses Better Auth, which provides:
- Enhanced security features
- Better session management
- More OAuth providers
- Improved developer experience

For a detailed migration guide, see the [Better Auth Supabase Migration Guide](https://www.better-auth.com/docs/guides/supabase-migration-guide).

## Related Packages

- [`@neondatabase/neon-js`](../neon-js) - Full SDK with database and auth integration
- [`@neondatabase/postgrest-js`](../postgrest-js) - PostgreSQL client without auth

## Resources

- [Neon Auth Documentation](https://neon.tech/docs/neon-auth)
- [Better Auth Documentation](https://www.better-auth.com/docs)
- [Supabase Auth Reference](https://supabase.com/docs/reference/javascript/auth-signup)

## License

Apache-2.0
