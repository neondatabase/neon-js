# neon-js

A TypeScript SDK that provides a unified authentication interface based on Supabase's auth API. The project uses an adapter pattern to support multiple authentication providers while maintaining a consistent API.

## Features

- **Unified Auth Interface**: Supabase-compatible authentication API
- **Adapter Pattern**: Pluggable authentication providers
- **Stack Auth Integration**: Full-featured Stack Auth adapter with session caching
- **Automatic Token Injection**: Auth-aware fetch wrapper for seamless API calls
- **TypeScript**: Full type safety with strict mode enabled
- **Performance Optimized**: Leverages Stack Auth's internal session cache for <5ms session reads

## Installation

### From npm

TODO

### From GitHub

```bash
npm install github:neondatabase-labs/neon-js
# or
bun add github:neondatabase-labs/neon-js
```

## Quick Start

```typescript
import { createClient } from 'neon-js';

// Create client with Stack Auth integration
const client = createClient({
  url: 'https://your-api.com',
  auth: {
    projectId: 'your-project-id',
    publishableClientKey: 'pk_...',
    tokenStore: 'cookie', // or 'memory'
  },
});

// Sign in
await client.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123',
});

// Get current session
const { data } = await client.auth.getSession();
console.log(data.session?.user);

// Make authenticated API calls (tokens injected automatically)
const { data: items } = await client.from('items').select();
```

## Architecture

- **AuthClient Interface**: Supabase-compatible authentication interface
- **Stack Auth Adapter**: Production-ready adapter with optimized session caching
- **NeonClient**: Extends PostgrestClient with integrated authentication
- **Factory Pattern**: `createClient()` handles initialization and wiring

## Development

Install dependencies:

```bash
bun install
```

Run development server with watch mode:

```bash
bun dev
```

Build the library:

```bash
bun build
```

Run tests:

```bash
bun test
```

Type check:

```bash
bun typecheck
```

## Publishing

Bump version and publish to npm:

```bash
bun release
```

## Project Structure

```
src/
├── auth/
│   ├── auth-interface.ts          # Core AuthClient interface
│   └── adapters/
│       └── stack-auth/
│           ├── stack-auth-adapter.ts   # Stack Auth implementation
│           ├── stack-auth-schemas.ts   # Zod schemas for JWT validation
│           └── stack-auth.test.ts      # Unit tests
├── client/
│   ├── neon-client.ts             # NeonClient and createClient() factory
│   ├── neon-client.test.ts        # Client tests
│   └── fetch-with-auth.ts         # Auth-aware fetch wrapper
└── index.ts                        # Public exports
```

## Authentication Methods

The SDK supports the following authentication methods via the Stack Auth adapter:

- **Email/Password**: `signUp()`, `signInWithPassword()`
- **OAuth**: `signInWithOAuth()` (supports all Stack Auth OAuth providers)
- **Magic Link**: `signInWithOtp()` (email-based passwordless authentication)
- **Session Management**: `getSession()`, `refreshSession()`, `signOut()`
- **User Management**: `getUser()`, `updateUser()`, `getClaims()`
- **Password Reset**: `resetPasswordForEmail()`

## Performance

The Stack Auth adapter is optimized for performance:

- **Cached `getSession()`**: <5ms (reads from Stack Auth internal cache, no I/O)
- **First `getSession()` after reload**: <50ms (Stack Auth reads from tokenStore)
- **Token refresh**: <200ms (network call to Stack Auth, happens automatically)

## License

MIT

## Links

- [Stack Auth Documentation](https://docs.stack-auth.com/)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [PostgrestClient Documentation](https://github.com/supabase/postgrest-js)
