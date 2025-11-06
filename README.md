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
│   ├── utils.ts                   # Shared utility functions
│   ├── __tests__/                 # Comprehensive test suite
│   │   ├── auth-flows.test.ts
│   │   ├── session-management.test.ts
│   │   ├── error-handling.test.ts
│   │   ├── oauth.test.ts
│   │   ├── oauth.browser.test.ts
│   │   ├── otp.test.ts
│   │   ├── user-management.test.ts
│   │   ├── stack-auth-helpers.test.ts
│   │   ├── supabase-compatibility.test.ts
│   │   ├── msw-setup.ts
│   │   ├── msw-handlers.ts
│   │   └── README.md
│   └── adapters/
│       ├── better-auth/            # Better Auth adapter (Primary)
│       │   ├── better-auth-adapter.ts   # Main implementation (46KB)
│       │   ├── better-auth-types.ts     # Type definitions
│       │   ├── better-auth-schemas.ts   # Zod schemas
│       │   ├── better-auth-helpers.ts   # Helper utilities
│       │   ├── better-auth-docs.md      # Documentation
│       │   ├── better-auth-plugins.md   # Plugin guide
│       │   └── better-auth-checklist.md # Implementation checklist
│       ├── stack-auth/             # Stack Auth adapter (Legacy)
│       │   ├── stack-auth-adapter.ts    # Implementation (2000+ lines)
│       │   ├── stack-auth-types.ts      # Type definitions
│       │   ├── stack-auth-schemas.ts    # Zod schemas
│       │   └── stack-auth-helpers.ts    # Helper utilities
│       ├── shared-helpers.ts       # Shared utilities
│       └── shared-schemas.ts       # Shared Zod schemas
├── client/
│   ├── neon-client.ts             # NeonClient class (extends PostgrestClient)
│   ├── client-factory.ts          # createClient() factory function
│   ├── neon-client.test.ts        # Client tests
│   └── fetch-with-auth.ts         # Auth-aware fetch wrapper
├── cli/
│   ├── index.ts                   # CLI entry point (bin: neon-js)
│   ├── commands/
│   │   ├── gen-types.ts           # Type generation command
│   │   └── generate-types.ts      # Core type generation logic
│   └── utils/
│       └── parse-duration.ts      # Duration parsing utility
└── index.ts                        # Public exports
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
