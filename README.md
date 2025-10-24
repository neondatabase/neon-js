# neon-js

A unified TypeScript SDK for Neon services, providing seamless integration with **Neon Auth** (authentication service) and **Neon Data API** (PostgreSQL database queries). Built with a Supabase-compatible interface for easy migration and familiar developer experience.

## Features

- **Unified SDK**: Single client for Neon Auth and Neon Data API
- **Supabase-Compatible**: Drop-in replacement for easy migration from Supabase
- **Adapter Pattern**: Pluggable authentication providers (Stack Auth included)
- **Automatic Token Injection**: Auth-aware fetch wrapper for seamless API calls
- **TypeScript**: Full type safety with strict mode enabled
- **Performance Optimized**: Leverages Stack Auth's internal session cache for <5ms session reads
- **CLI Tool**: Generate TypeScript types from your database schema

## Installation

### From npm

```bash
npm install @neondatabase/neon-js
```

## Using neon-js

1. Create a Neon project with Data API enabled
2. Copy env vars from the Data API page and set them in your environment
```bash
VITE_STACK_PROJECT_ID=
VITE_STACK_PUBLISHABLE_CLIENT_KEY=
VITE_NEON_DATA_API_URL=
```
3. Instantiate `createClient` with the correct parameters
```typescript
import { createClient } from 'neon-js';

const client = createClient({
  url: 'https://your-api.com',
  auth: {
    projectId: 'your-project-id',
    publishableClientKey: 'pk_...',
    tokenStore: 'cookie', // or 'memory'
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
- VITE_SUPABASE_PROJECT_ID="..."
- VITE_SUPABASE_PUBLISHABLE_KEY="..."
- VITE_SUPABASE_URL="https://xxx.supabase.co"
+ VITE_NEON_DATA_API_URL="https://xxx.apirest.c-2.us-east-1.aws.neon.tech/neondb/rest/v1"
+ VITE_STACK_PROJECT_ID="..."
+ VITE_STACK_PUBLISHABLE_CLIENT_KEY="..."
```

Get these values from your Neon dashboard:
- **Data API URL**: Available in the Neon console under "Data API"
- **Stack Auth credentials**: Project ID and Publishable Client Key from Neon Auth setup

**3. Update Client Initialization**

Update your client configuration to use neon-js:

```diff
- import { createClient } from '@supabase/supabase-js';
+ import { createClient } from 'neon-js';

- export const supabase = createClient(
-   import.meta.env.VITE_SUPABASE_URL,
-   import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
- );
+ export const supabase = createClient({
+   url: import.meta.env.VITE_NEON_DATA_API_URL,
+   auth: {
+     tokenStore: 'cookie',
+     projectId: import.meta.env.VITE_STACK_PROJECT_ID,
+     publishableClientKey: import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY,
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

### Real-World Example

See the complete migration in this PR: [pffigueiredo/todo-guardian-pro#1](https://github.com/pffigueiredo/todo-guardian-pro/pull/1)

The migration changed only:
- 1 dependency in `package.json`
- 3 environment variables in `.env`
- Client initialization in `src/integrations/supabase/client.ts`

Everything else stayed the same!

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
  url: 'https://your-api.com',
  auth: {
    projectId: 'your-project-id',
    publishableClientKey: 'pk_...',
    tokenStore: 'cookie', // Use cookies in browser
  },
});
```

### Node.js

```typescript
// All auth methods work, cross-tab features automatically disabled
import { createClient } from 'neon-js';

const client = createClient({
  url: 'https://your-api.com',
  auth: {
    projectId: 'your-project-id',
    publishableClientKey: 'pk_...',
    tokenStore: 'memory', // Use memory storage in Node.js
  },
});
```

### Server-Side (with secret key)

```typescript
import { createClient } from 'neon-js';

const client = createClient({
  url: 'https://your-api.com',
  auth: {
    projectId: 'your-project-id',
    secretServerKey: 'sk_...', // Server key for server-side operations
    tokenStore: 'memory',
  },
});
```

## Architecture

- **NeonClient**: Unified client for Neon Auth and Data API (extends PostgrestClient)
- **AuthClient Interface**: Supabase-compatible authentication interface for easy migration
- **Adapter Pattern**: Pluggable authentication providers (Stack Auth included)
- **Factory Pattern**: `createClient()` handles initialization and wiring
- **Performance Optimized**: Session caching, automatic token injection, and retry logic

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
│       └── stack-auth/
│           ├── stack-auth-adapter.ts   # Stack Auth implementation (2000+ lines)
│           ├── stack-auth-types.ts     # Type definitions and interfaces
│           ├── stack-auth-schemas.ts   # Zod schemas for JWT validation
│           └── stack-auth-helpers.ts   # Helper utilities
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

The SDK supports the following authentication methods via the Stack Auth adapter:

### Fully Supported Methods
- **Email/Password**: `signUp()`, `signInWithPassword()`
- **OAuth**: `signInWithOAuth()` (supports all Stack Auth OAuth providers)
- **Magic Link**: `signInWithOtp()`, `verifyOtp()` (email-based passwordless authentication)
- **Session Management**: `getSession()`, `refreshSession()`, `setSession()`, `signOut()`
- **User Management**: `getUser()`, `updateUser()`, `getClaims()`, `getUserIdentities()`
- **Identity Linking**: `linkIdentity()`, `unlinkIdentity()`
- **Password Reset**: `resetPasswordForEmail()`, `resend()`
- **OAuth Callback**: `exchangeCodeForSession()`
- **State Monitoring**: `onAuthStateChange()`

### Unsupported Methods (Return Detailed Errors)
- **OIDC ID Token**: `signInWithIdToken()` - Stack Auth uses OAuth redirects only
- **SAML SSO**: `signInWithSSO()` - Stack Auth only supports OAuth social providers
- **Web3/Crypto**: `signInWithWeb3()` - Stack Auth does not support blockchain authentication
- **Anonymous**: `signInAnonymously()` - Use OAuth or email/password instead

For unsupported methods, the adapter returns comprehensive error messages explaining the limitation and suggesting alternatives.

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
