---
name: neon-js-nextjs
description: Sets up the full Neon SDK with authentication AND database queries in Next.js App Router apps. Creates typed client, generates database types, and configures auth UI. Use for auth + database integration.
allowed-tools: ["Bash", "Write", "Read", "Edit", "Glob", "Grep"]
---

# Neon JS for Next.js

Help developers set up @neondatabase/neon-js with authentication AND database queries in Next.js App Router applications.

## When to Use

Use this skill when:
- Setting up Neon Auth + Database in a Next.js App Router app
- User needs both authentication AND database queries
- User mentions "neon-js", "neon auth + database", or "full neon SDK" with Next.js
- User is using Next.js (App Router)

## Critical Rules

1. **Server vs Client imports**: Use correct import paths
2. **`'use client'` directive**: Required for client components using hooks
3. **Adapter Factory Pattern**: Always call adapters with `()`
4. **CSS Import**: Choose ONE - either `/ui/css` OR `/ui/tailwind`, never both
5. **onSessionChange**: Always call `router.refresh()` to update Server Components
6. **Type Safety**: Always use Database generic for type-safe queries

## Critical Imports

| Purpose | Import From |
|---------|-------------|
| API Handler | `@neondatabase/neon-js/auth/next/server` |
| Middleware | `@neondatabase/neon-js/auth/next/server` |
| Server Session (`neonAuth`) | `@neondatabase/neon-js/auth/next/server` |
| Server Actions (`createAuthServer`) | `@neondatabase/neon-js/auth/next/server` |
| Client Auth | `@neondatabase/neon-js/auth/next` |
| UI Components | `@neondatabase/neon-js/auth/react` |
| View Paths (static params) | `@neondatabase/neon-js/auth/react/ui/server` |

---

## Setup

### 1. Install
```bash
npm install @neondatabase/neon-js
```

### 2. Environment (`.env.local`)
```
NEON_AUTH_BASE_URL=https://your-auth.neon.tech
NEON_DATA_API_URL=https://your-data-api.neon.tech/rest/v1
DATABASE_URL=postgresql://user:pass@host:5432/db
```

### 3. Generate Database Types
```bash
npx neon-js gen-types --db-url "$DATABASE_URL" --output src/database.types.ts
```

**CLI Options:**
```bash
npx neon-js gen-types --db-url <url> [options]

# Required
--db-url <url>              Database connection string

# Optional
--output, -o <path>         Output file (default: database.types.ts)
--schema, -s <name>         Schema to include (repeatable, default: public)
--postgrest-v9-compat       Disable one-to-one relationship detection
--query-timeout <duration>  Query timeout (e.g., 30s, 1m, default: 15s)
```

### 4. API Route (`app/api/auth/[...path]/route.ts`)
```typescript
import { authApiHandler } from '@neondatabase/neon-js/auth/next/server';

export const { GET, POST } = authApiHandler();
```

### 5. Middleware (`middleware.ts`)
```typescript
import { neonAuthMiddleware } from '@neondatabase/neon-js/auth/next/server';

export default neonAuthMiddleware({
  loginUrl: '/auth/sign-in',
});

export const config = {
  matcher: ['/dashboard/:path*', '/account/:path*'],
};
```

### 6. Create Neon Client (`lib/neon-client.ts`)
```typescript
import { createClient } from '@neondatabase/neon-js';
import type { Database } from '@/database.types';

export const neonClient = createClient<Database>({
  auth: {
    url: process.env.NEON_AUTH_BASE_URL!,
    // allowAnonymous: true, // Enable for RLS access without login
  },
  dataApi: {
    url: process.env.NEON_DATA_API_URL!,
  },
});
```

### 7. Client Auth (`lib/auth-client.ts`)
```typescript
'use client';
import { createAuthClient } from '@neondatabase/neon-js/auth/next';

export const authClient = createAuthClient();
```

### 8. Provider (`app/providers.tsx`)
```typescript
'use client';
import { NeonAuthUIProvider } from '@neondatabase/neon-js/auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <NeonAuthUIProvider
      authClient={authClient}
      navigate={router.push}
      replace={router.replace}
      onSessionChange={() => router.refresh()}
      redirectTo="/dashboard"
      Link={Link}
    >
      {children}
    </NeonAuthUIProvider>
  );
}
```

### 9. Layout (`app/layout.tsx`)
```typescript
import { Providers } from './providers';
import '@neondatabase/neon-js/ui/css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### 10. Auth Pages (`app/auth/[path]/page.tsx`)
```typescript
import { AuthView } from '@neondatabase/neon-js/auth/react';
import { authViewPaths } from '@neondatabase/neon-js/auth/react/ui/server';

export function generateStaticParams() {
  return Object.values(authViewPaths).map((path) => ({ path }));
}

export default async function AuthPage({ params }: { params: Promise<{ path: string }> }) {
  const { path } = await params;
  return <AuthView pathname={path} />;
}
```

---

## CSS & Styling

### Import Options

**Without Tailwind** (pre-built CSS bundle ~47KB):
```typescript
// app/layout.tsx
import '@neondatabase/neon-js/ui/css';
```

**With Tailwind CSS v4** (`app/globals.css`):
```css
@import 'tailwindcss';
@import '@neondatabase/neon-js/ui/tailwind';
```

**IMPORTANT**: Never import both - causes duplicate styles.

### Dark Mode

```typescript
<NeonAuthUIProvider
  defaultTheme="system" // 'light' | 'dark' | 'system'
  // ...
>
```

### Custom Theming

Override CSS variables in `globals.css`:
```css
:root {
  --primary: hsl(221.2 83.2% 53.3%);
  --primary-foreground: hsl(210 40% 98%);
  --background: hsl(0 0% 100%);
  --foreground: hsl(222.2 84% 4.9%);
  --card: hsl(0 0% 100%);
  --card-foreground: hsl(222.2 84% 4.9%);
  --border: hsl(214.3 31.8% 91.4%);
  --input: hsl(214.3 31.8% 91.4%);
  --ring: hsl(221.2 83.2% 53.3%);
  --radius: 0.5rem;
}

.dark {
  --background: hsl(222.2 84% 4.9%);
  --foreground: hsl(210 40% 98%);
  /* ... dark mode overrides */
}
```

---

## Database Queries

### Server Components

```typescript
// NO 'use client' - this is a Server Component
import { neonClient } from '@/lib/neon-client';

export async function TodoList() {
  const { data: todos, error } = await neonClient
    .from('todos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return <div>Error loading todos</div>;

  return (
    <ul>
      {todos?.map((todo) => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  );
}
```

### Route Handlers

```typescript
// app/api/todos/route.ts
import { neonClient } from '@/lib/neon-client';
import { neonAuth } from '@neondatabase/neon-js/auth/next/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const { user } = await neonAuth();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await neonClient
    .from('todos')
    .select('*')
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const { user } = await neonAuth();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  const { data, error } = await neonClient
    .from('todos')
    .insert({ ...body, user_id: user.id })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

### Server Actions

```typescript
// app/actions/todos.ts
'use server';
import { neonClient } from '@/lib/neon-client';
import { neonAuth } from '@neondatabase/neon-js/auth/next/server';
import { revalidatePath } from 'next/cache';

export async function createTodo(formData: FormData) {
  const { user } = await neonAuth();

  if (!user) {
    return { error: 'Unauthorized' };
  }

  const { error } = await neonClient
    .from('todos')
    .insert({
      title: formData.get('title') as string,
      user_id: user.id,
    });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/dashboard');
}

export async function toggleTodo(id: string, completed: boolean) {
  const { user } = await neonAuth();

  if (!user) {
    return { error: 'Unauthorized' };
  }

  const { error } = await neonClient
    .from('todos')
    .update({ completed })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/dashboard');
}

export async function deleteTodo(id: string) {
  const { user } = await neonAuth();

  if (!user) {
    return { error: 'Unauthorized' };
  }

  const { error } = await neonClient
    .from('todos')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/dashboard');
}
```

### Query Patterns

```typescript
// Select with filter
const { data, error } = await neonClient
  .from('todos')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });

// Select with relations
const { data, error } = await neonClient
  .from('posts')
  .select(`
    *,
    author:users(name, avatar),
    comments(id, content)
  `);

// Single row
const { data, error } = await neonClient
  .from('todos')
  .select('*')
  .eq('id', todoId)
  .single();

// Insert with return
const { data, error } = await neonClient
  .from('todos')
  .insert({ title: 'New todo', user_id: userId })
  .select()
  .single();

// Update
const { data, error } = await neonClient
  .from('todos')
  .update({ completed: true })
  .eq('id', todoId)
  .select()
  .single();

// Delete
const { error } = await neonClient
  .from('todos')
  .delete()
  .eq('id', todoId);

// Upsert
const { data, error } = await neonClient
  .from('profiles')
  .upsert({ user_id: userId, bio: 'Updated bio' })
  .select()
  .single();
```

### Filters

```typescript
// Equality
.eq('column', value)
.neq('column', value)

// Comparison
.gt('column', value)      // greater than
.gte('column', value)     // greater than or equal
.lt('column', value)      // less than
.lte('column', value)     // less than or equal

// Pattern matching
.like('column', '%pattern%')
.ilike('column', '%pattern%')  // case insensitive

// Arrays
.in('column', [1, 2, 3])
.contains('tags', ['javascript'])

// Null
.is('column', null)
.not('column', 'is', null)

// Pagination
.range(0, 9)
.limit(10)
```

---

## Server Components (RSC)

### Get Session in Server Component

```typescript
// NO 'use client' - this is a Server Component
import { neonAuth } from '@neondatabase/neon-js/auth/next/server';

export async function Profile() {
  const { session, user } = await neonAuth();

  if (!user) return <div>Not signed in</div>;

  return (
    <div>
      <p>Hello, {user.name}</p>
      <p>Email: {user.email}</p>
    </div>
  );
}
```

---

## Server Actions (Auth)

### Setup Server Auth (`lib/auth/server.ts`)

```typescript
import { createAuthServer } from '@neondatabase/neon-js/auth/next/server';

export const authServer = createAuthServer();
```

### Auth Actions

```typescript
// app/actions/auth.ts
'use server';
import { authServer } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export async function signIn(formData: FormData) {
  const { error } = await authServer.signIn.email({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  });

  if (error) {
    return { error: error.message };
  }

  redirect('/dashboard');
}

export async function signUp(formData: FormData) {
  const { error } = await authServer.signUp.email({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    name: formData.get('name') as string,
  });

  if (error) {
    return { error: error.message };
  }

  redirect('/dashboard');
}

export async function signOut() {
  await authServer.signOut();
  redirect('/');
}
```

### Available Server Methods

```typescript
// Authentication
authServer.signIn.email({ email, password })
authServer.signUp.email({ email, password, name })
authServer.signOut()
authServer.getSession()

// User Management
authServer.updateUser({ name, image })

// Organizations
authServer.organization.create({ name, slug })
authServer.organization.list()
```

---

## Client Components

### Session Hook

```typescript
'use client';
import { authClient } from '@/lib/auth-client';

export function Dashboard() {
  const { data: session, isPending, error } = authClient.useSession();

  if (isPending) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!session) return <div>Not signed in</div>;

  return <div>Hello, {session.user.name}</div>;
}
```

### Client-Side Auth Methods

```typescript
'use client';
import { authClient } from '@/lib/auth-client';

// Sign in
await authClient.signIn.email({ email, password });

// Sign up
await authClient.signUp.email({ email, password, name });

// OAuth
await authClient.signIn.social({
  provider: 'google',
  callbackURL: '/dashboard',
});

// Sign out
await authClient.signOut();

// Get session
const session = await authClient.getSession();
```

---

## UI Components

### AuthView - Main Auth Interface

```typescript
import { AuthView } from '@neondatabase/neon-js/auth/react';

// Handles: sign-in, sign-up, forgot-password, reset-password, callback, sign-out
<AuthView pathname={path} />
```

### Conditional Rendering

```typescript
import {
  SignedIn,
  SignedOut,
  AuthLoading,
  RedirectToSignIn,
} from '@neondatabase/neon-js/auth/react';

function MyPage() {
  return (
    <>
      <AuthLoading>
        <LoadingSpinner />
      </AuthLoading>

      <SignedIn>
        <Dashboard />
      </SignedIn>

      <SignedOut>
        <LandingPage />
      </SignedOut>

      {/* Auto-redirect if not signed in */}
      <RedirectToSignIn />
    </>
  );
}
```

### UserButton

```typescript
import { UserButton } from '@neondatabase/neon-js/auth/react';

function Header() {
  return (
    <header>
      <nav>...</nav>
      <UserButton />
    </header>
  );
}
```

### Account Management

```typescript
import {
  AccountSettingsCards,
  SecuritySettingsCards,
  SessionsCard,
  ChangePasswordCard,
  ChangeEmailCard,
  DeleteAccountCard,
  ProvidersCard,
} from '@neondatabase/neon-js/auth/react';
```

### Organization Components

```typescript
import {
  OrganizationSwitcher,
  OrganizationSettingsCards,
  OrganizationMembersCard,
  AcceptInvitationCard,
} from '@neondatabase/neon-js/auth/react';
```

---

## NeonAuthUIProvider Props

Full configuration:

```typescript
<NeonAuthUIProvider
  // Required
  authClient={authClient}

  // Navigation (Next.js specific)
  navigate={router.push}
  replace={router.replace}
  onSessionChange={() => router.refresh()} // Refresh Server Components!
  redirectTo="/dashboard"
  Link={Link}

  // Social/OAuth
  social={{
    providers: ['google', 'github', 'twitter', 'discord'],
  }}

  // Feature Flags
  emailOTP={true}
  emailVerification={true}
  magicLink={false}
  multiSession={false}
  credentials={{ forgotPassword: true }}

  // Sign Up Fields
  signUp={{ fields: ['name'] }}

  // Account Fields
  account={{ fields: ['image', 'name', 'company'] }}

  // Organizations
  organization={{}}

  // Dark Mode
  defaultTheme="system"

  // Custom Labels
  localization={{
    SIGN_IN: 'Welcome Back',
    SIGN_UP: 'Create Account',
  }}
>
  {children}
</NeonAuthUIProvider>
```

---

## Social/OAuth Providers

### Configuration

```typescript
<NeonAuthUIProvider
  social={{
    providers: ['google', 'github', 'twitter', 'discord', 'apple', 'microsoft'],
  }}
>
```

### Programmatic OAuth

```typescript
// Client-side
await authClient.signIn.social({
  provider: 'google',
  callbackURL: '/dashboard',
});
```

### Supported Providers

`google`, `github`, `twitter`, `discord`, `apple`, `microsoft`, `facebook`, `linkedin`, `spotify`, `twitch`, `gitlab`, `bitbucket`

---

## Middleware Configuration

### Basic Protected Routes

```typescript
import { neonAuthMiddleware } from '@neondatabase/neon-js/auth/next/server';

export default neonAuthMiddleware({
  loginUrl: '/auth/sign-in',
});

export const config = {
  matcher: ['/dashboard/:path*', '/account/:path*', '/settings/:path*'],
};
```

### Custom Logic

```typescript
import { neonAuthMiddleware } from '@neondatabase/neon-js/auth/next/server';

export default neonAuthMiddleware({
  loginUrl: '/auth/sign-in',
  callbacks: {
    authorized: async ({ auth, request }) => {
      if (request.nextUrl.pathname.startsWith('/admin')) {
        return auth?.user?.role === 'admin';
      }
      return !!auth;
    },
  },
});
```

---

## Advanced Features

### Anonymous Access

Enable RLS-based data access for unauthenticated users:

```typescript
// lib/neon-client.ts
export const neonClient = createClient<Database>({
  auth: {
    url: process.env.NEON_AUTH_BASE_URL!,
    allowAnonymous: true,
  },
  dataApi: {
    url: process.env.NEON_DATA_API_URL!,
  },
});
```

### Get JWT Token

```typescript
const token = await authClient.getJWTToken();

// Use in API calls
const response = await fetch('/api/external', {
  headers: { Authorization: `Bearer ${token}` },
});
```

### Cross-Tab Sync

Automatic via BroadcastChannel. Sign out in one tab signs out all tabs.

### Session Refresh in Server Components

The `onSessionChange` callback is crucial for Next.js:

```typescript
<NeonAuthUIProvider
  onSessionChange={() => router.refresh()} // Refreshes Server Components!
  // ...
>
```

Without this, Server Components won't update after sign-in/sign-out.

---

## Error Handling

### Database Errors

```typescript
const { data, error } = await neonClient.from('todos').select('*');

if (error) {
  console.error('Query failed:', error.message);
  return;
}
```

### Auth Errors

```typescript
const { error } = await authClient.signIn.email({ email, password });

if (error) {
  toast.error(error.message);
}
```

### Common Errors

| Error | Cause |
|-------|-------|
| `Invalid credentials` | Wrong email/password |
| `User already exists` | Email registered |
| `permission denied for table` | Missing RLS policy or GRANT |
| `JWT expired` | Token needs refresh |
| `Session not found` | Expired or invalid session |

---

## FAQ / Troubleshooting

### Server Components not updating after sign-in?

Make sure you have `onSessionChange={() => router.refresh()}` in your provider.

### Anonymous access not working?

Grant permissions to the `anonymous` role in your database:

```sql
GRANT SELECT ON public.posts TO anonymous;
GRANT SELECT ON public.products TO anonymous;
```

And configure RLS policies:

```sql
CREATE POLICY "Anyone can read published posts"
  ON public.posts FOR SELECT
  USING (published = true);
```

### "permission denied for table" error?

1. Check RLS is enabled: `ALTER TABLE posts ENABLE ROW LEVEL SECURITY;`
2. Create appropriate policies for authenticated users
3. Grant permissions: `GRANT SELECT, INSERT ON public.posts TO authenticated;`

### Database types out of date?

Regenerate types after schema changes:

```bash
npx neon-js gen-types --db-url "postgresql://..." --output src/database.types.ts
```

### Middleware not protecting routes?

Check your `matcher` configuration:

```typescript
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/account/:path*',
    // Add your protected routes here
  ],
};
```

### OAuth callback errors?

Ensure your API route is set up correctly at `app/api/auth/[...path]/route.ts`.

### Session not persisting?

1. Cookies enabled?
2. `NEON_AUTH_BASE_URL` correct in `.env.local`?
3. Not in incognito with cookies blocked?

---

## Performance Notes

- **Session caching**: 60-second TTL
- **Request deduplication**: Concurrent calls share single request
- **Server Components**: Use `neonAuth()` for zero-JS session access
- **Auto token injection**: JWT automatically added to all queries
- **Cross-tab sync**: <50ms via BroadcastChannel
