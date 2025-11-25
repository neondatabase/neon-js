# @neondatabase/neon-js

The official TypeScript SDK for Neon, combining authentication and database querying in a familiar interface.

## Overview

`@neondatabase/neon-js` is a comprehensive SDK that brings together Neon Auth and Neon Data API. It provides a unified client for managing authentication and querying PostgreSQL databases with a familiar, intuitive interface.

**Key Features:**

- **Integrated Authentication** - Multiple auth adapters (Supabase-compatible, Better Auth)
- **PostgreSQL Querying** - Full PostgREST client with type-safe queries
- **High Performance** - Session caching, request deduplication
- **Automatic Token Management** - Seamless token injection for database queries
- **TypeScript First** - Fully typed with strict type checking
- **Universal** - Works in Node.js, browsers, and edge runtimes

## Installation

```bash
npm install @neondatabase/neon-js
# or
bun add @neondatabase/neon-js
```

## Quick Start

### Using SupabaseAdapter (Supabase-compatible API)

```typescript
import { createClient, SupabaseAdapter } from '@neondatabase/neon-js';

const client = createClient<Database>({
  auth: {
    adapter: SupabaseAdapter,
    url: import.meta.env.VITE_NEON_AUTH_URL,
  },
  dataApi: {
    url: import.meta.env.VITE_NEON_DATA_API_URL,
  },
});

// Authenticate with Supabase-compatible API
await client.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'secure-password',
});

// Query database (token automatically injected)
const { data: users, error } = await client
  .from('users')
  .select('*')
  .eq('status', 'active');
```

### Using BetterAuthVanillaAdapter (Direct Better Auth API)

```typescript
import { createClient, BetterAuthVanillaAdapter } from '@neondatabase/neon-js';

const client = createClient<Database>({
  auth: {
    adapter: BetterAuthVanillaAdapter,
    url: import.meta.env.VITE_NEON_AUTH_URL,
  },
  dataApi: {
    url: import.meta.env.VITE_NEON_DATA_API_URL,
  },
});

// Authenticate with Better Auth API
await client.auth.signIn.email({
  email: 'user@example.com',
  password: 'secure-password',
});

// Query database (token automatically injected)
const { data: users } = await client
  .from('users')
  .select('*');
```

### Using BetterAuthReactAdapter (Better Auth with React Hooks)

```typescript
import { createClient, BetterAuthReactAdapter } from '@neondatabase/neon-js';

const client = createClient<Database>({
  auth: {
    adapter: BetterAuthReactAdapter,
    url: import.meta.env.VITE_NEON_AUTH_URL,
  },
  dataApi: {
    url: import.meta.env.VITE_NEON_DATA_API_URL,
  },
});

// Use in React components
function MyComponent() {
  const session = client.auth.useSession();

  if (session.isPending) return <div>Loading...</div>;
  if (!session.data) return <div>Not logged in</div>;

  return <div>Hello, {session.data.user.name}</div>;
}
```

## Authentication

### Sign Up (SupabaseAdapter)

```typescript
await client.auth.signUp({
  email: 'user@example.com',
  password: 'secure-password',
  options: {
    data: {
      name: 'John Doe',
      avatar_url: 'https://example.com/avatar.jpg',
    },
  },
});
```

### Sign Up (BetterAuth Adapters)

```typescript
await client.auth.signUp.email({
  email: 'user@example.com',
  password: 'secure-password',
  name: 'John Doe',
});
```

### Sign In (SupabaseAdapter)

```typescript
// Email & Password
await client.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'secure-password',
});

// OAuth
await client.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: '/dashboard',
  },
});
```

### Sign In (BetterAuth Adapters)

```typescript
// Email & Password
await client.auth.signIn.email({
  email: 'user@example.com',
  password: 'secure-password',
});

// OAuth
await client.auth.signIn.social({
  provider: 'google',
  callbackURL: '/dashboard',
});
```

### Session Management (SupabaseAdapter)

```typescript
// Get current session
const { data: session } = await client.auth.getSession();

// Get current user
const { data: user } = await client.auth.getUser();

// Update user
await client.auth.updateUser({
  data: {
    name: 'Jane Doe',
  },
});

// Sign out
await client.auth.signOut();
```

### Session Management (BetterAuth Adapters)

```typescript
// Get current session
const session = await client.auth.getSession();

// Sign out
await client.auth.signOut();
```

### Auth State Changes (SupabaseAdapter)

```typescript
client.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    console.log('User signed in:', session?.user);
  } else if (event === 'SIGNED_OUT') {
    console.log('User signed out');
  }
});
```

## Database Querying

### SELECT Queries

```typescript
// Simple select
const { data } = await client
  .from('users')
  .select('id, name, email');

// With filters
const { data } = await client
  .from('posts')
  .select('*')
  .eq('status', 'published')
  .gt('views', 100)
  .order('created_at', { ascending: false })
  .limit(10);

// Joins
const { data } = await client
  .from('posts')
  .select(`
    id,
    title,
    author:users(name, email)
  `)
  .eq('status', 'published');
```

### INSERT Queries

```typescript
// Insert single row
const { data } = await client
  .from('users')
  .insert({
    name: 'Alice',
    email: 'alice@example.com',
  })
  .select();

// Insert multiple rows
const { data } = await client
  .from('users')
  .insert([
    { name: 'Bob', email: 'bob@example.com' },
    { name: 'Carol', email: 'carol@example.com' },
  ])
  .select();
```

### UPDATE Queries

```typescript
const { data } = await client
  .from('users')
  .update({ status: 'inactive' })
  .eq('last_login', null)
  .select();
```

### DELETE Queries

```typescript
const { data } = await client
  .from('users')
  .delete()
  .eq('status', 'deleted')
  .select();
```

### RPC (Stored Procedures)

```typescript
const { data } = await client
  .rpc('get_user_stats', {
    user_id: 123,
    start_date: '2024-01-01',
  });
```

## Configuration

### Client Options

```typescript
import { createClient, SupabaseAdapter } from '@neondatabase/neon-js';

const client = createClient({
  // Auth configuration
  auth: {
    adapter: SupabaseAdapter,
    url: 'https://your-auth-server.neon.tech/auth',
    options: {
      // Additional adapter-specific options
    },
  },

  // Data API configuration
  dataApi: {
    url: 'https://your-data-api.neon.tech/rest/v1',
    options: {
      db: {
        schema: 'public', // Default schema
      },
      global: {
        headers: {
          'X-Custom-Header': 'value',
        },
      },
    },
  },
});
```

### Environment Variables

```bash
# Auth URL
NEON_AUTH_URL=https://your-auth-server.neon.tech/auth

# Data API URL
NEON_DATA_API_URL=https://your-data-api.neon.tech/rest/v1
```

```typescript
import { createClient, SupabaseAdapter } from '@neondatabase/neon-js';

const client = createClient({
  auth: {
    adapter: SupabaseAdapter,
    url: process.env.NEON_AUTH_URL!,
  },
  dataApi: {
    url: process.env.NEON_DATA_API_URL!,
  },
});
```

## TypeScript

Generate TypeScript types from your database schema:

```bash
npx neon-js gen-types --connection-string "postgresql://user:pass@host/db"
```

Use generated types for full type safety:

```typescript
import type { Database } from './types/database';
import { createClient, SupabaseAdapter } from '@neondatabase/neon-js';

const client = createClient<Database>({
  auth: {
    adapter: SupabaseAdapter,
    url: process.env.NEON_AUTH_URL!,
  },
  dataApi: {
    url: process.env.NEON_DATA_API_URL!,
  },
});

// Fully typed queries!
const { data } = await client
  .from('users') // Autocomplete for table names
  .select('id, name, email') // Autocomplete for column names
  .eq('status', 'active'); // Type checking for values
```

## CLI Tool

Generate TypeScript types from your database:

```bash
# Generate types
npx neon-js gen-types \
  --connection-string "postgresql://user:pass@host/db" \
  --output ./types/database.ts

# With schema filtering
npx neon-js gen-types \
  --connection-string "postgresql://user:pass@host/db" \
  --schemas public,auth \
  --output ./types/database.ts
```

**Options:**
- `--connection-string`, `-c` - PostgreSQL connection string (required)
- `--output`, `-o` - Output file path (default: `./types/database.ts`)
- `--schemas`, `-s` - Comma-separated list of schemas (default: `public`)

## Performance

### Session Caching

Sessions are cached in memory with intelligent TTL:
- **Cold start:** ~200ms (single network request)
- **Cached reads:** <1ms (in-memory, no I/O)
- **Cache TTL:** 60 seconds or until JWT expires
- **Smart expiration:** Automatic based on JWT claims

### Request Deduplication

Concurrent authentication calls are automatically deduplicated:
- **Without deduplication:** 10 concurrent calls = 10 requests (~2000ms)
- **With deduplication:** 10 concurrent calls = 1 request (~200ms)
- **Result:** 10x faster, N-1 fewer server requests

## Environment Compatibility

- **Node.js** 14+ (with native fetch or polyfill)
- **Browser** (all modern browsers)
- **Edge Runtime** (Vercel, Cloudflare Workers, Deno, etc.)
- **Bun** (native support)

## Error Handling

```typescript
import { AuthError } from '@neondatabase/neon-js';

// Auth errors (SupabaseAdapter)
try {
  await client.auth.signInWithPassword({ email, password });
} catch (error) {
  if (error instanceof AuthError) {
    console.error('Auth error:', error.message);
  }
}

// Database errors
const { data, error } = await client.from('users').select();
if (error) {
  console.error('Database error:', error.message);
}
```

## Examples

### Next.js App Router

```typescript
// app/lib/neon.ts
import { createClient, SupabaseAdapter } from '@neondatabase/neon-js';

export const neon = createClient({
  auth: {
    adapter: SupabaseAdapter,
    url: process.env.NEON_AUTH_URL!,
  },
  dataApi: {
    url: process.env.NEON_DATA_API_URL!,
  },
});

// app/api/users/route.ts
import { neon } from '@/lib/neon';

export async function GET() {
  const { data: users } = await neon.from('users').select('*');
  return Response.json(users);
}
```

### React Hook with BetterAuthReactAdapter

```typescript
import { createClient, BetterAuthReactAdapter } from '@neondatabase/neon-js';

const client = createClient({
  auth: {
    adapter: BetterAuthReactAdapter,
    url: process.env.NEXT_PUBLIC_NEON_AUTH_URL!,
  },
  dataApi: {
    url: process.env.NEXT_PUBLIC_NEON_DATA_API_URL!,
  },
});

export function useAuth() {
  const session = client.auth.useSession();

  return {
    user: session.data?.user ?? null,
    isPending: session.isPending,
    signIn: (email: string, password: string) =>
      client.auth.signIn.email({ email, password }),
    signOut: () => client.auth.signOut(),
  };
}
```

## Related Packages

This package combines two underlying packages:

- [`@neondatabase/neon-auth`](../neon-auth) - Authentication adapters (can be used standalone)
- [`@neondatabase/postgrest-js`](../postgrest-js) - PostgreSQL client (can be used standalone)

## Migration from Previous Version

If you're migrating from the old API that used `dataApiUrl` and `authUrl` directly:

```typescript
// Before (old API)
const client = createClient({
  dataApiUrl: 'https://data-api.example.com/rest/v1',
  authUrl: 'https://auth.example.com',
});

// After (new API with adapters)
import { createClient, SupabaseAdapter } from '@neondatabase/neon-js';

const client = createClient({
  auth: {
    adapter: SupabaseAdapter,
    url: 'https://auth.example.com',
  },
  dataApi: {
    url: 'https://data-api.example.com/rest/v1',
  },
});
```

## Resources

- [Neon Documentation](https://neon.tech/docs)
- [Neon Auth Documentation](https://neon.tech/docs/neon-auth)
- [Better Auth Documentation](https://www.better-auth.com/docs)
- [PostgREST Documentation](https://postgrest.org)

## Support

- [GitHub Issues](https://github.com/neondatabase/neon-js/issues)
- [Neon Community Discord](https://discord.gg/neon)

## License

Apache-2.0
