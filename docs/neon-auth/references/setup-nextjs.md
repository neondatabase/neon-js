# Neon Auth Setup - Next.js App Router

Complete setup instructions for Neon Auth in Next.js App Router applications.

---

## 1. Install Package

```bash
npm install @neondatabase/auth
# Or: npm install @neondatabase/neon-js
```

## 2. Environment Variables

Create or update `.env.local`:

```bash
NEON_AUTH_BASE_URL=https://ep-xxx.neonauth.c-2.us-east-2.aws.neon.build/dbname/auth
NEXT_PUBLIC_NEON_AUTH_URL=https://ep-xxx.neonauth.c-2.us-east-2.aws.neon.build/dbname/auth
```

**Important:** Both variables are needed:

- `NEON_AUTH_BASE_URL` - Used by server-side API routes
- `NEXT_PUBLIC_NEON_AUTH_URL` - Used by client-side components (prefixed with NEXT_PUBLIC_)

**Where to find your Auth URL:**

1. Go to your Neon project dashboard
2. Navigate to the "Auth" tab
3. Copy the Auth URL

## 3. API Route Handler

Create `app/api/auth/[...path]/route.ts`:

```typescript
import { authApiHandler } from "@neondatabase/auth/next";
// Or: import { authApiHandler } from "@neondatabase/neon-js/auth/next";

export const { GET, POST } = authApiHandler();
```

This creates endpoints for:

- `/api/auth/sign-in` - Sign in
- `/api/auth/sign-up` - Sign up
- `/api/auth/sign-out` - Sign out
- `/api/auth/session` - Get session
- And other auth-related endpoints

## 4. Auth Client Configuration

Create `lib/auth/client.ts`:

```typescript
"use client";
import { createAuthClient } from "@neondatabase/auth/next";
// Or: import { createAuthClient } from "@neondatabase/neon-js/auth/next";

export const authClient = createAuthClient();
```

## 5. Use in Components

```typescript
"use client";

import { authClient } from "@/lib/auth/client";

function AuthStatus() {
  const session = authClient.useSession();

  if (session.isPending) return <div>Loading...</div>;
  if (!session.data) return <SignInButton />;

  return (
    <div>
      <p>Hello, {session.data.user.name}</p>
      <button onClick={() => authClient.signOut()}>Sign Out</button>
    </div>
  );
}

function SignInButton() {
  return (
    <button onClick={() => authClient.signIn.email({
      email: "user@example.com",
      password: "password"
    })}>
      Sign In
    </button>
  );
}
```

## 6. UI Provider Setup (Optional)

For pre-built UI components (AuthView, UserButton, etc.), see [ui-components.md](ui-components.md).

---

## Server-Side Auth

### Get Session in Server Components

```typescript
// NO 'use client' - this is a Server Component
import { neonAuth } from '@neondatabase/auth/next/server';

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

### Server Actions

```typescript
// lib/auth/server.ts
import { createAuthServer } from '@neondatabase/auth/next/server';
export const authServer = createAuthServer();

// app/actions/auth.ts
'use server';
import { authServer } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export async function signIn(formData: FormData) {
  const { error } = await authServer.signIn.email({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  });

  if (error) return { error: error.message };
  redirect('/dashboard');
}

export async function signOut() {
  await authServer.signOut();
  redirect('/');
}
```

---

## Middleware (Route Protection)

Create `middleware.ts`:

```typescript
import { neonAuthMiddleware } from '@neondatabase/auth/next/server';

export default neonAuthMiddleware({
  loginUrl: '/auth/sign-in',
});

export const config = {
  matcher: ['/dashboard/:path*', '/account/:path*'],
};
```

---

## Package Selection

| Need                    | Package                 | Bundle Size     |
| ----------------------- | ----------------------- | --------------- |
| Auth only               | `@neondatabase/auth`    | Smaller (~50KB) |
| Auth + Database queries | `@neondatabase/neon-js` | Full (~150KB)   |

**Recommendation:** Use `@neondatabase/auth` if you only need authentication. Use `@neondatabase/neon-js` if you also need PostgREST-style database queries.

---

## Import Reference

| Purpose | Import From |
|---------|-------------|
| API Handler | `@neondatabase/auth/next` |
| Middleware | `@neondatabase/auth/next/server` |
| Server Session (`neonAuth`) | `@neondatabase/auth/next/server` |
| Server Actions (`createAuthServer`) | `@neondatabase/auth/next/server` |
| Client Auth | `@neondatabase/auth/next` |
| UI Components | `@neondatabase/auth/react/ui` |
| View Paths | `@neondatabase/auth/react/ui/server` |
