# neon-js

A unified TypeScript SDK for Neon services, providing seamless integration with authentication and PostgreSQL database queries. Offers a familiar, type-safe API for building modern applications with Neon.

## Table of Contents

- [neon-js](#neon-js)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Installation](#installation)
  - [Prerequisites](#prerequisites)
  - [Which Package Should I Use?](#which-package-should-i-use)
  - [Quick Start](#quick-start)
  - [CLI Tool: Generate Types](#cli-tool-generate-types)
    - [Basic Usage](#basic-usage)
    - [Flags](#flags)
  - [Usage Examples](#usage-examples)
    - [Using @neondatabase/neon-js (Recommended)](#using-neondatabaseneon-js-recommended)
    - [Using @neondatabase/postgrest-js (No Auth)](#using-neondatabasepostgrest-js-no-auth)
    - [Using @neondatabase/auth-js (Custom Integrations)](#using-neondatabaseauth-js-custom-integrations)
  - [Supabase Migration Guide](#supabase-migration-guide)
    - [Quick Migration Steps](#quick-migration-steps)
  - [Authentication Methods](#authentication-methods)
    - [Core Methods](#core-methods)
  - [Environment Support](#environment-support)
  - [Architecture](#architecture)
  - [Performance](#performance)
  - [Development](#development)
  - [License](#license)
  - [Links](#links)

## Features

- **Unified SDK**: Single client for authentication and database queries
- **Familiar API**: Drop-in replacement with minimal code changes for migration
- **Adapter Pattern**: Pluggable authentication providers (Better Auth & Stack Auth)
- **Automatic Token Injection**: Seamless authentication for all database calls
- **TypeScript**: Full type safety with strict mode enabled
- **Performance Optimized**: Cross-tab sync and automatic token refresh
- **CLI Tool**: Generate TypeScript types from your database schema

## Installation

```bash
npm install @neondatabase/neon-js
```

## Prerequisites

Before using neon-js, you'll need:

1. **A Neon account and project**
   - Sign up at [neon.tech](https://neon.tech)
   - Create a new project in the Neon Console

2. **Enable the Data API** (for database queries)
   - Go to your project settings in Neon Console
   - Enable the Data API feature
   - Copy your Data API URL (format: `https://ep-withered-pond-w4e43v69.c-2.us-east-2.aws.neon.build/neondb/`)

3. **Configure environment variables**

Create a `.env` file in your project:

```bash
# Your Neon Data API endpoint
VITE_NEON_DATA_API_URL=https://ep-withered-pond-w4e43v69.apirest.c-2.us-east-2.aws.neon.build/neondb/rest/v1

# Your Neon Auth endpoint
VITE_NEON_AUTH_URL=https://ep-withered-pond-w4e43v69.neonauth.c-2.us-east-2.aws.neon.build/neondb/auth
```

## Which Package Should I Use?

This monorepo contains three packages. Choose based on your needs:

- **`@neondatabase/neon-js`** (Recommended): Full-featured SDK with auth + Neon Data API. Use this for most applications.
- **`@neondatabase/postgrest-js`**: Database queries only. Use when you handle authentication externally or don't need auth.
- **`@neondatabase/auth-js`**: Authentication only. Use when you want to use Neon Auth for authentication and don't need to use the Neon Data API.
- 
## Quick Start

Here's a complete example showing authentication and database queries:

```typescript
import { createClient } from '@neondatabase/neon-js';

// OPTIONAL: generate these types file with the CLI tool bellow
import type { Database } from './types/database.types';

// Create client with Better Auth integration
const client = createClient<Database>({
  dataApiUrl: import.meta.env.VITE_NEON_DATA_API_URL,
  authUrl: import.meta.env.VITE_NEON_AUTH_URL,
});

// Sign in
await client.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123',
});

// Get current session
const { data: session } = await client.auth.getSession();
console.log('User:', session?.user);

// Query database (tokens injected automatically)
const { data: items } = await client.from('items').select();

// Insert data
await client.from('items').insert({ name: 'New Item', status: 'active' });

// Update data
await client.from('items').update({ status: 'completed' }).eq('id', 1);

// Delete data
await client.from('items').delete().eq('id', 1);
```

## CLI Tool: Generate Types

The `@neondatabase/neon-js` package includes a CLI tool for generating TypeScript types from your database schema. This ensures type safety for your database queries.

### Basic Usage

No installation required! Use via npx:

```bash
# Generate types from your database
npx @neondatabase/neon-js gen-types --db-url "postgresql://user:pass@host:5432/db"

# Custom output path
npx @neondatabase/neon-js gen-types --db-url "postgresql://..." --output src/types/database.ts

# Multiple schemas
npx @neondatabase/neon-js gen-types --db-url "postgresql://..." -s public -s auth

# Custom timeout
npx @neondatabase/neon-js gen-types --db-url "postgresql://..." --query-timeout 30s
```

### Flags

- `--db-url <url>` - Database connection string (required)
- `--output <path>`, `-o <path>` - Output file path (default: `database.types.ts`)
- `--schema <name>`, `-s <name>` - Schema to include (can be used multiple times, default: `public`)
- `--postgrest-v9-compat` - Disable one-to-one relationship detection
- `--query-timeout <duration>` - Query timeout (default: `15s`, format: `30s`, `1m`, `90s`)

## Usage Examples

### Using @neondatabase/neon-js (Recommended)

Full-featured SDK with authentication and database queries:

```typescript
import { createClient } from '@neondatabase/neon-js';

const client = createClient<Database>({
  dataApiUrl: import.meta.env.VITE_NEON_DATA_API_URL,
  authUrl: import.meta.env.VITE_NEON_AUTH_URL,
});

// All auth methods available
await client.auth.signInWithPassword({ email, password });
const { data: session } = await client.auth.getSession();

// Database queries with automatic token injection
const { data } = await client.from('items').select();
```

### Using @neondatabase/postgrest-js (No Auth)

For scenarios where authentication is handled externally:

```typescript
import { NeonPostgrestClient, fetchWithToken } from '@neondatabase/postgrest-js';

// Option 1: Manual token in headers
const client = new NeonPostgrestClient({
  dataApiUrl: 'https://your-data-api.com/rest/v1',
  options: {
    global: {
      headers: { 'Authorization': 'Bearer YOUR_TOKEN' },
    },
  },
});

// Option 2: Custom token provider
const client = new NeonPostgrestClient({
  dataApiUrl: 'https://your-data-api.com/rest/v1',
  options: {
    global: {
      fetch: fetchWithToken(async () => {
        // Your custom token logic
        return 'YOUR_TOKEN';
      }),
    },
  },
});

// Database queries
const { data } = await client.from('items').select();
```

### Using @neondatabase/auth-js (Custom Integrations)

For building custom clients or integrations:

```typescript
import { NeonAuthClient } from '@neondatabase/auth-js';

const auth = new NeonAuthClient({
  baseURL: import.meta.env.VITE_NEON_AUTH_URL,
});

// Use auth methods directly
await auth.signInWithPassword({ email, password });
const { data: session } = await auth.getSession();
```

## Supabase Migration Guide

neon-js provides a Supabase compatible API, making migration straightforward with minimal code changes.

### Quick Migration Steps

**1. Update Dependencies**

```diff
- "@supabase/supabase-js": "^2.74.0"
+ "@neondatabase/neon-js": "^0.1.0"
```

**2. Update Environment Variables**

```diff
- VITE_SUPABASE_URL="https://xxx.supabase.co"
- VITE_SUPABASE_ANON_KEY="..."
+ VITE_NEON_DATA_API_URL="https://xxx.neon.tech/neondb/rest/v1"
+ VITE_NEON_AUTH_URL="https://your-auth-server.com"
```

**3. Update Client Initialization**

```diff
- import { createClient } from '@supabase/supabase-js';
+ import { createClient } from '@neondatabase/neon-js';

- export const client = createClient(
-   import.meta.env.VITE_SUPABASE_URL,
-   import.meta.env.VITE_SUPABASE_ANON_KEY
- );
+ export const client = createClient<Database>({
+   dataApiUrl: import.meta.env.VITE_NEON_DATA_API_URL,
+   authUrl: import.meta.env.VITE_NEON_AUTH_URL,
+ });
```

**4. Done!**

All authentication methods (`signInWithPassword`, `signOut`, `getUser`, etc.) and database queries (`from().select()`, etc.) work the same. See the [real-world migration example](https://github.com/pffigueiredo/todo-guardian-pro/pull/1) for more details.

## Authentication Methods

The SDK supports comprehensive authentication methods via the Better Auth adapter:

### Core Methods
- **Email/Password**: `signUp()`, `signInWithPassword()`
- **OAuth**: `signInWithOAuth()` (supports Better Auth OAuth providers)
- **Magic Link/OTP**: `signInWithOtp()`, `verifyOtp()`
- **Session Management**: `getSession()`, `refreshSession()`, `setSession()`, `signOut()`
- **User Management**: `getUser()`, `updateUser()`, `getClaims()`, `getUserIdentities()`
- **Identity Linking**: `linkIdentity()`, `unlinkIdentity()`
- **Password Reset**: `resetPasswordForEmail()`, `resend()`
- **State Monitoring**: `onAuthStateChange()` with cross-tab synchronization

## Environment Support

The SDK works in both browser and Node.js environments:

- **Browser**: Full feature support including cross-tab sync
- **Node.js**: Core auth works, browser-only features automatically disabled

## Architecture

- **NeonClient**: Unified client for authentication and database queries
- **AuthClient Interface**: Compatible authentication interface for easy adoption
- **Adapter Pattern**: Pluggable authentication providers (Better Auth primary, Stack Auth legacy)
- **Factory Pattern**: `createClient()` handles initialization and wiring
- **Performance Optimized**: Cross-tab sync, automatic token refresh detection, and seamless token injection

## Performance

The Better Auth adapter provides production-ready performance:

- **Session retrieval**: Fast session access via Better Auth's built-in caching
- **Token refresh**: Automatic token refresh with 30-second polling interval
- **Cross-tab sync**: Real-time authentication state synchronization across browser tabs (browser only)
- **Zero latency token injection**: Automatic Bearer token injection for all authenticated requests

## Development

This is a Bun workspaces monorepo with three packages. For detailed development instructions, see [CLAUDE.md](./CLAUDE.md).

**Quick start:**

```bash
bun install          # Install dependencies
bun dev              # Watch mode for all packages
bun build            # Build all packages
bun test             # Run tests
bun typecheck        # Type check all packages
```

## License

MIT

## Links

- [Neon Documentation](https://neon.tech/docs)
- [Better Auth Documentation](https://www.better-auth.com/docs)
- [GitHub Repository](https://github.com/neondatabase-labs/neon-js)
