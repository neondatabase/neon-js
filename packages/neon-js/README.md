# @neondatabase/neon-js

The official TypeScript SDK for Neon, combining authentication and database querying in a Supabase-compatible interface.

## Overview

`@neondatabase/neon-js` is a comprehensive SDK that brings together Neon Auth and Neon Data API. It provides a unified client for managing authentication and querying PostgreSQL databases with a familiar Supabase-compatible interface.

**Key Features:**

- = **Integrated Authentication** - Built on Better Auth with Supabase API compatibility
- =� **PostgreSQL Querying** - Full PostgREST client with type-safe queries
- � **High Performance** - Session caching, request deduplication, and cross-tab sync
- = **Automatic Token Management** - Seamless token injection for database queries
- =� **TypeScript First** - Fully typed with strict type checking
- < **Universal** - Works in Node.js, browsers, and edge runtimes

## Installation

```bash
npm install @neondatabase/neon-js
# or
bun add @neondatabase/neon-js
```

## Quick Start

```typescript
import { createClient } from '@neondatabase/neon-js';

// Create client with auth and database configuration
const client = createClient<Database>(import.meta.env.VITE_NEON_URL);

// Authenticate
await client.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'secure-password',
});

// Query database (token automatically injected)
const { data: users, error } = await client
  .from('users')
  .select('*')
  .eq('status', 'active');

console.log(users);
```

## Authentication

### Sign Up

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

### Sign In

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

### Session Management

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

### Auth State Changes

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
import { createClient } from '@neondatabase/neon-js';

const client = createClient({
  // Required: Database URL
  url: 'https://your-neon-branch.neon.tech/dbname',

  // Required: Auth configuration
  auth: {
    baseURL: 'https://your-auth-server.com',
  },

  // Optional: Client options
  options: {
    // Database options
    db: {
      schema: 'public', // Default schema
    },

    // Global options for all requests
    global: {
      headers: {
        'X-Custom-Header': 'value',
      },
    },
  },
});
```

### Environment Variables

```bash
# Database URL
DATABASE_URL=https://your-neon-branch.neon.tech/dbname

# Auth server URL
AUTH_BASE_URL=https://your-auth-server.com
```

```typescript
const client = createClient({
  url: process.env.DATABASE_URL!,
  auth: {
    baseURL: process.env.AUTH_BASE_URL!,
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
import { createClient } from '@neondatabase/neon-js';

const client = createClient<Database>({
  url: process.env.DATABASE_URL!,
  auth: {
    baseURL: process.env.AUTH_BASE_URL!,
  },
});

// Fully typed queries!
const { data } = await client
  .from('users') //  Autocomplete for table names
  .select('id, name, email') //  Autocomplete for column names
  .eq('status', 'active'); //  Type checking for values
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

### Cross-Tab Sync

Auth state syncs across browser tabs (browser only):
- **Sync method:** BroadcastChannel API
- **Latency:** <50ms
- **Events:** Sign in, sign out, token refresh, user updates

## Environment Compatibility

-  **Node.js** 14+ (with native fetch or polyfill)
-  **Browser** (all modern browsers)
-  **Edge Runtime** (Vercel, Cloudflare Workers, Deno, etc.)
-  **Bun** (native support)

**Note:** Cross-tab sync is browser-only. All other features work in all environments.

## Error Handling

```typescript
import { AuthError, PostgrestError } from '@neondatabase/neon-js';

// Auth errors
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
import { createClient } from '@neondatabase/neon-js';

export const neon = createClient({
  url: process.env.DATABASE_URL!,
  auth: {
    baseURL: process.env.AUTH_BASE_URL!,
  },
});

// app/api/users/route.ts
import { neon } from '@/lib/neon';

export async function GET() {
  const { data: users } = await neon.from('users').select('*');
  return Response.json(users);
}
```

### React Hook

```typescript
import { useEffect, useState } from 'react';
import { createClient } from '@neondatabase/neon-js';

const client = createClient({
  url: process.env.NEXT_PUBLIC_DATABASE_URL!,
  auth: {
    baseURL: process.env.NEXT_PUBLIC_AUTH_BASE_URL!,
  },
});

export function useAuth() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Get initial session
    client.auth.getUser().then(({ data }) => setUser(data));

    // Listen for changes
    const { data: subscription } = client.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return {
    user,
    signIn: (email: string, password: string) =>
      client.auth.signInWithPassword({ email, password }),
    signOut: () => client.auth.signOut(),
  };
}
```

## Related Packages

This package combines two underlying packages:

- [`@neondatabase/auth`](../auth) - Authentication adapter (can be used standalone)
- [`@neondatabase/postgrest-js`](../postgrest-js) - PostgreSQL client (can be used standalone)

## Migration Guides

### From Supabase

The API is designed to be compatible with Supabase:

```typescript
// Before (Supabase)
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(url, anonKey);

// After (Neon)
import { createClient } from '@neondatabase/neon-js';
const neon = createClient({
  url,
  auth: { baseURL: authUrl },
});

// Same API for queries and auth!
const { data } = await neon.from('users').select();
```

For detailed migration instructions, see the [Better Auth Supabase Migration Guide](https://www.better-auth.com/docs/guides/supabase-migration-guide).

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
