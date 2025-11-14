# neon-js

A unified TypeScript SDK for Neon services, providing seamless integration with **Neon Auth** (authentication service) and **Neon Data API** (PostgreSQL database queries). Built with a Supabase-compatible interface for easy migration and familiar developer experience.

## Features

- **Unified SDK**: Single client for Neon Auth and Neon Data API
- **Supabase-Compatible**: Drop-in replacement for easy migration from Supabase
- **Adapter Pattern**: Pluggable authentication providers (Better Auth & Stack Auth included)
- **Automatic Token Injection**: Auth-aware fetch wrapper for seamless API calls
- **TypeScript**: Full type safety with strict mode enabled
- **Performance Optimized**: Better Auth adapter with cross-tab sync and automatic token refresh detection
- **CLI Tool**: Generate TypeScript types from your database schema

## Installation

### From npm

```bash
npm install @neondatabase/neon-js
```

## Using neon-js

1. Create a Neon project with Data API enabled
2. Set up your Better Auth server (see [Better Auth docs](https://www.better-auth.com/docs))
3. Set environment variables:
```bash
VITE_BETTER_AUTH_BASE_URL=https://your-auth-server.com
VITE_NEON_DATA_API_URL=https://your-neon-api.com
```
4. Instantiate `createClient` with the correct parameters:
```typescript
import { createClient } from 'neon-js';

const client = createClient({
  url: import.meta.env.VITE_NEON_DATA_API_URL,
  auth: {
    baseURL: import.meta.env.VITE_BETTER_AUTH_BASE_URL,
  },
  options: {
    // Optional: custom configuration
    global: {
      headers: { 'X-Custom-Header': 'value' },
    },
    db: {
      schema: 'public',
    },
  },
});
```

## Migrating from Supabase

neon-js provides a Supabase-compatible API, making migration straightforward with minimal code changes. Here's a real-world migration example from the [Todo Guardian Pro project](https://github.com/pffigueiredo/todo-guardian-pro/pull/1).

### Migration Steps

**1. Update Dependencies**

Replace `@supabase/supabase-js` with `neon-js` in your `package.json`:

```diff
- "@supabase/supabase-js": "^2.74.0"
+ "neon-js": "^0.0.0"
```

**2. Update Environment Variables**

Replace Supabase environment variables with Neon equivalents:

```diff
- VITE_SUPABASE_URL="https://xxx.supabase.co"
- VITE_SUPABASE_ANON_KEY="..."
+ VITE_NEON_DATA_API_URL="https://xxx.apirest.c-2.us-east-1.aws.neon.tech/neondb/rest/v1"
+ VITE_BETTER_AUTH_BASE_URL="https://your-auth-server.com"
```

Get these values from:
- **Data API URL**: Available in the Neon console under "Data API"
- **Better Auth Base URL**: Your Better Auth server URL (see [Better Auth docs](https://www.better-auth.com/docs))

**3. Update Client Initialization**

Update your client configuration to use neon-js:

```diff
- import { createClient } from '@supabase/supabase-js';
+ import { createClient } from 'neon-js';

- export const supabase = createClient(
-   import.meta.env.VITE_SUPABASE_URL,
-   import.meta.env.VITE_SUPABASE_ANON_KEY
- );
+ export const neon = createClient({
+   url: import.meta.env.VITE_NEON_DATA_API_URL,
+   auth: {
+     baseURL: import.meta.env.VITE_BETTER_AUTH_BASE_URL,
+   },
+ });
```

**4. Done!**

That's it! The rest of your code remains unchanged. All authentication methods (`signInWithPassword`, `signOut`, `getUser`, etc.) and database queries (`from().select()`, etc.) work exactly the same.

### What Stays the Same

- ✅ All authentication method signatures
- ✅ All database query methods
- ✅ Session management APIs
- ✅ User management APIs
- ✅ OAuth flows
- ✅ Error handling patterns

### Migration Notes

**Note**: The example above shows migrating from Supabase to neon-js with Better Auth. The actual migration requires:
1. Setting up a Better Auth server (see [Better Auth docs](https://www.better-auth.com/docs))
2. Updating environment variables
3. Changing client initialization

All Supabase Auth method signatures remain the same, making the migration seamless for your application code.

## Quick Start

```typescript
import { createClient } from 'neon-js';

// Create client with Better Auth integration
const client = createClient({
  url: 'https://your-neon-api.com',
  auth: {
    baseURL: 'https://your-auth-server.com',
  },
});

// Sign in (Supabase-compatible API)
await client.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123',
});

// Get current session
const { data } = await client.auth.getSession();

// Make authenticated API calls (tokens injected automatically)
const { data: items } = await client.from('items').select();
```

## Environment Support

The SDK works in both browser and Node.js environments:

### Browser

```typescript
// Full feature support including cross-tab sync
import { createClient } from 'neon-js';

const client = createClient({
  url: 'https://your-neon-api.com',
  auth: {
    baseURL: 'https://your-auth-server.com',
  },
});
```

### Node.js

```typescript
// All auth methods work, cross-tab features automatically disabled
import { createClient } from 'neon-js';

const client = createClient({
  url: 'https://your-neon-api.com',
  auth: {
    baseURL: 'https://your-auth-server.com',
  },
});
```

## Architecture

- **NeonClient**: Unified client for Neon Auth and Data API (extends PostgrestClient)
- **AuthClient Interface**: Supabase-compatible authentication interface for easy migration
- **Adapter Pattern**: Pluggable authentication providers (Better Auth primary, Stack Auth legacy)
- **Factory Pattern**: `createClient()` handles initialization and wiring
- **Performance Optimized**: Cross-tab sync, automatic token refresh detection, and seamless token injection

## Development

This is a Bun workspaces monorepo with three packages:

- `packages/shared/` - Internal shared utilities (not published)
- `packages/auth/` - Authentication adapters (`@neon-js/auth`)
- `packages/neon-js/` - Main SDK package (`@neondatabase/neon-js`)

Install dependencies:

```bash
bun install
```

Run development server with watch mode:

```bash
bun dev
```

Build all packages:

```bash
bun build
```

Build a specific package:

```bash
bun run --filter '@neon-js/auth' build
```

Run tests:

```bash
bun test
```

Type check all packages:

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
packages/
├── shared/                    # @neon-js/shared (INTERNAL)
│   └── src/
│       ├── utils/
│       │   └── date.ts       # Date utilities
│       ├── schemas/
│       │   └── index.ts      # Shared Zod schemas
│       └── index.ts
│
├── auth/                      # @neon-js/auth (PUBLISHED)
│   └── src/
│       ├── auth-interface.ts  # Core AuthClient interface
│       ├── utils.ts           # Shared utility re-exports
│       ├── adapters/
│       │   ├── better-auth/   # Better Auth adapter (Primary)
│       │   │   ├── better-auth-adapter.ts
│       │   │   ├── better-auth-types.ts
│       │   │   ├── better-auth-helpers.ts
│       │   │   ├── in-flight-request-manager.ts
│       │   │   ├── constants.ts
│       │   │   └── index.ts
│       │   ├── stack-auth/    # Stack Auth adapter (Legacy)
│       │   │   ├── stack-auth-adapter.ts
│       │   │   ├── stack-auth-types.ts
│       │   │   ├── stack-auth-schemas.ts
│       │   │   ├── stack-auth-helpers.ts
│       │   │   └── index.ts
│       │   ├── shared-helpers.ts
│       │   ├── shared-schemas.ts
│       │   └── index.ts
│       ├── __tests__/         # Comprehensive test suite
│       │   └── ...
│       └── index.ts
│
└── neon-js/                   # @neondatabase/neon-js (PUBLISHED)
    └── src/
        ├── client/
        │   ├── neon-client.ts
        │   ├── client-factory.ts
        │   ├── fetch-with-auth.ts
        │   └── index.ts
        ├── cli/
        │   ├── index.ts
        │   ├── commands/
        │   │   ├── gen-types.ts
        │   │   └── generate-types.ts
        │   └── utils/
        │       └── parse-duration.ts
        └── index.ts
```

## CLI Tool: Generate Types

The `neon-js` package includes a CLI tool for generating TypeScript types from your database schema.

### Installation

No installation required! Use via npx:

```bash
npx neon-js gen-types --db-url "postgresql://..."
```

### Usage

```bash
npx neon-js gen-types --db-url <url> [flags]
```

#### Required Flags

- `--db-url <url>` - Database connection string

#### Optional Flags

- `--output <path>`, `-o <path>` - Output file path (default: `database.types.ts`)
- `--schema <name>`, `-s <name>` - Schema to include (can be used multiple times, default: `public`)
- `--postgrest-v9-compat` - Disable one-to-one relationship detection
- `--query-timeout <duration>` - Query timeout (default: `15s`, format: `30s`, `1m`, `90s`)

#### Examples

```bash
# Basic usage
npx neon-js gen-types --db-url "postgresql://user:pass@host:5432/db"

# Custom output path
npx neon-js gen-types --db-url "postgresql://..." --output src/types/db.ts

# Multiple schemas
npx neon-js gen-types --db-url "postgresql://..." -s public -s auth

# PostgREST v9 compatibility
npx neon-js gen-types --db-url "postgresql://..." --postgrest-v9-compat

# Custom timeout
npx neon-js gen-types --db-url "postgresql://..." --query-timeout 30s
```

## Authentication Methods

The SDK supports the following authentication methods via the Better Auth adapter:

### Fully Supported Methods
- **Email/Password**: `signUp()`, `signInWithPassword()`
- **OAuth**: `signInWithOAuth()` (supports Better Auth OAuth providers)
- **Magic Link/OTP**: `signInWithOtp()`, `verifyOtp()` (email-based passwordless authentication)
- **Session Management**: `getSession()`, `refreshSession()`, `setSession()`, `signOut()`
- **User Management**: `getUser()`, `updateUser()`, `getClaims()`, `getUserIdentities()`
- **Identity Linking**: `linkIdentity()`, `unlinkIdentity()`
- **Password Reset**: `resetPasswordForEmail()`, `resend()`
- **State Monitoring**: `onAuthStateChange()` with cross-tab synchronization

All methods maintain Supabase API compatibility for seamless migration.

## Performance

The Better Auth adapter provides production-ready performance:

- **Session retrieval**: Fast session access via Better Auth's built-in caching
- **Token refresh**: Automatic token refresh with 30-second polling interval
- **Cross-tab sync**: Real-time authentication state synchronization across browser tabs (browser only)
- **Zero latency token injection**: Automatic Bearer token injection for all authenticated requests

## License

MIT

## Links

- [Better Auth Documentation](https://www.better-auth.com/docs)
- [Better Auth Supabase Migration Guide](https://www.better-auth.com/docs/guides/supabase-migration-guide)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [PostgrestClient Documentation](https://github.com/supabase/postgrest-js)
- [Neon Documentation](https://neon.tech/docs)
