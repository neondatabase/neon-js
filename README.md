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

TODO: add `dist` to `.gitignore` once we have a release

```bash
npm install git+ssh://git@github.com/neondatabase-labs/neon-js.git
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
});
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
