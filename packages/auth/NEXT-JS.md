# @neondatabase/auth/next

[![npm downloads](https://img.shields.io/npm/dm/@neondatabase/auth.svg)](https://www.npmjs.com/package/@neondatabase/auth)

A Next.js integration for **Neon Auth** (`@neondatabase/auth`). This guide demonstrates how to integrate Neon's authentication system with a modern Next.js 15+ application.

## Features

- 🔐 **Email OTP Authentication** - Passwordless login with email verification
- 🔗 **Social Login** - Google OAuth integration
- 👥 **Organizations** - Multi-tenant organization support
- 🎨 **Pre-built UI Components** - Beautiful, customizable auth views
- ⚡ **React Server Components** - Access session data in RSC
- 🌙 **Dark Mode Support** - Built-in theme support

## Setup Guide

### 1. Install the Package

```bash
npm install @neondatabase/auth
# or
pnpm add @neondatabase/auth
# or
yarn add @neondatabase/auth
```

### 2. Set Environment Variable

Export the `NEON_AUTH_BASE_URL` environment variable pointing to your Neon Auth server:

```bash
# .env.local
NEON_AUTH_BASE_URL=https://your-neon-auth-url.neon.tech
```

### 3. Create an Auth Handler

To integrate Neon Auth with Next.js, mount the auth handler to an API route. Create a route file inside `/api/auth/[...path]` directory:

```typescript
// app/api/auth/[...path]/route.ts
import { authApiHandler } from "@neondatabase/auth/next"

export const { GET, POST } = authApiHandler()
```

### 4. Set Up Middleware (Optional)

Create a `middleware.ts` file in your project root to protect routes and handle session validation:

```typescript
// middleware.ts
import { neonAuthMiddleware } from "@neondatabase/auth/next"

export default neonAuthMiddleware({
  loginUrl: "/auth/sign-in",
})

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
```

### 5. Create the Auth Client

Create a client instance that can be used in client components to sign up, sign in, and perform other auth-related actions:

```typescript
// lib/auth-client.ts
"use client"

import { createAuthClient } from "@neondatabase/auth/next"

export const authClient = createAuthClient()

// Or with anonymous access for unauthenticated users
export const authClient = createAuthClient({
  allowAnonymous: true, // Enable anonymous token for RLS
})
```

### 6. Set Up the Neon Auth UI Provider

Create a providers component and wrap your application with `NeonAuthUIProvider`:

```typescript
// app/providers.tsx
"use client"

import { NeonAuthUIProvider } from "@neondatabase/auth/react/ui"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"

import { authClient } from "@/lib/auth-client"

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter()

  return (
    <NeonAuthUIProvider
      authClient={authClient}
      navigate={router.push}
      replace={router.replace}
      onSessionChange={() => {
        // Clear router cache (protected routes)
        router.refresh()
      }}
      emailOTP
      social={{
        providers: ["google"],
      }}
      redirectTo="/dashboard"
      Link={Link}
      organization={{}}
    >
      {children}
    </NeonAuthUIProvider>
  )
}
```

Then wrap your layout:

```typescript
// app/layout.tsx
import { Providers } from "./providers"
import "./globals.css"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

### 7. Import CSS Styles

Choose the import method based on your project setup:

#### Option A: Without Tailwind CSS (recommended for most users)

If your project doesn't use Tailwind CSS, import the pre-built CSS bundle:

```typescript
// In your root layout or app entry point
import "@neondatabase/auth/ui/css"
```

This includes all necessary styles with no additional configuration required.

#### Option B: With Tailwind CSS

If your project already uses Tailwind CSS v4, import the Tailwind-ready CSS to avoid duplicate styles:

```css
/* In your main CSS file (e.g., globals.css) */
@import "tailwindcss";
@import "@neondatabase/auth/ui/tailwind";
```

This imports only the theme variables and component scanning directive. Your Tailwind build will generate the necessary utility classes, avoiding duplication with your existing Tailwind setup.

### 8. Create Auth Pages

#### Auth Page (Sign In, Sign Up, etc.)

Create a dynamic route file at `app/auth/[path]/page.tsx` to handle all authentication views:

```typescript
// app/auth/[path]/page.tsx
import { AuthView } from "@neondatabase/auth/react/ui"
import { authViewPaths } from "@neondatabase/auth/react/ui/server"

export const dynamicParams = false

export function generateStaticParams() {
  return Object.values(authViewPaths).map((path) => ({ path }))
}

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>
}) {
  const { path } = await params

  return (
    <main className="container flex grow flex-col items-center justify-center p-4">
      <AuthView path={path} />
    </main>
  )
}
```

This automatically handles the following authentication routes:

- `/auth/sign-in` - Sign in page
- `/auth/sign-up` - Sign up page
- `/auth/magic-link` - Magic link authentication
- `/auth/forgot-password` - Password reset request
- `/auth/two-factor` - Two-factor authentication
- `/auth/recover-account` - Account recovery
- `/auth/reset-password` - Password reset
- `/auth/sign-out` - Sign out
- `/auth/callback` - OAuth callback
- `/auth/accept-invitation` - Accept team invitation

#### Account Page

```typescript
// app/account/[path]/page.tsx
import { AccountView } from "@neondatabase/auth/react/ui"
import { accountViewPaths } from "@neondatabase/auth/react/ui/server"

export const dynamicParams = false

export function generateStaticParams() {
  return Object.values(accountViewPaths).map((path) => ({ path }))
}

export default async function AccountPage({
  params,
}: {
  params: Promise<{ path: string }>
}) {
  const { path } = await params

  return (
    <main className="container p-4">
      <AccountView path={path} />
    </main>
  )
}
```

#### Organization Page

```typescript
// app/organization/[path]/page.tsx
import { OrganizationView } from "@neondatabase/auth/react/ui"
import { organizationViewPaths } from "@neondatabase/auth/react/ui/server"

export const dynamicParams = false

export function generateStaticParams() {
  return Object.values(organizationViewPaths).map((path) => ({ path }))
}

export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ path: string }>
}) {
  const { path } = await params

  return (
    <main className="container p-4">
      <OrganizationView path={path} />
    </main>
  )
}
```

## Accessing Session Data

### React Server Components

Use the `neonAuth()` function to access session and user data in React Server Components:

```typescript
// app/components/session-card.tsx
import { neonAuth } from "@neondatabase/auth/next"

export async function SessionCard() {
  const { session, user } = await neonAuth()
  const isLoggedIn = !!session && !!user

  if (!isLoggedIn) {
    return <div>Not logged in</div>
  }

  return (
    <div>
      <p>Welcome, {user.name || user.email}</p>
      <p>User ID: {user.id}</p>
      <p>Session expires: {new Date(session.expiresAt).toLocaleString()}</p>
      {user.image && <img src={user.image} alt="User avatar" />}
    </div>
  )
}
```

### Client Components

For client components, use the `authClient.useSession()` hook:

```typescript
// app/dashboard/page.tsx
"use client"

import { authClient } from "@/lib/auth-client"

export default function DashboardPage() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return <div>Loading...</div>
  }

  if (!session) {
    return <div>Not authenticated</div>
  }

  return (
    <div>
      <h1>Welcome, {session.user.name || session.user.email}</h1>
      <p>User ID: {session.user.id}</p>
      <p>Session ID: {session.session.id}</p>
    </div>
  )
}
```

## Server-Side Auth Operations

For Server Actions, Route Handlers, and other server-side auth operations, use `createAuthServer()` from `@neondatabase/auth/next/server`:

```typescript
// lib/auth/server.ts
import { createAuthServer } from '@neondatabase/auth/next/server';
export const authServer = createAuthServer();
```

### Server Action Example

```typescript
// app/actions.ts
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
  redirect('/auth/sign-in');
}
```

### Available APIs

The `authServer` provides access to all Neon Auth APIs:

- **Session**: `getSession()`, `listSessions()`, `revokeSession()`, `revokeOtherSessions()`
- **Auth**: `signIn.email()`, `signIn.social()`, `signIn.emailOtp()`, `signUp.email()`, `signOut()`
- **User**: `updateUser()`, `changePassword()`, `deleteUser()`, `sendVerificationEmail()`
- **Organization**: `organization.create()`, `organization.list()`, `organization.inviteMember()`, `organization.removeMember()`, etc.
- **Admin**: `admin.listUsers()`, `admin.banUser()`, `admin.setRole()`, `admin.createUser()`, etc.
- **Email OTP**: `emailOtp.sendVerificationOtp()`, `emailOtp.verifyEmail()`

## Project Structure

```
app/
├── api/
│   └── auth/
│       └── [...path]/
│           └── route.ts      # Auth API handlers
├── auth/
│   └── [path]/
│       └── page.tsx          # Auth views (sign-in, sign-up, etc.)
├── account/
│   └── [path]/
│       └── page.tsx          # Account management views
├── organization/
│   └── [path]/
│       └── page.tsx          # Organization views
├── dashboard/
│   └── page.tsx              # Protected dashboard page
├── providers.tsx             # NeonAuthUIProvider setup
├── layout.tsx                # Root layout with providers
└── globals.css               # Global styles with Neon Auth CSS

lib/
└── auth-client.ts            # Auth client instance

middleware.ts                 # Route protection
```

## Learn More

- [Neon Auth Documentation](https://neon.tech/docs/guides/neon-auth)
- [better-auth-ui Documentation](https://better-auth-ui.com/integrations/next-js)
- [Next.js Documentation](https://nextjs.org/docs)
