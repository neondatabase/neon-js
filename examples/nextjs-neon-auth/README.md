# Neon Auth Demo App

A Next.js demo application showcasing authentication with **Neon Auth** (`@neondatabase/auth`). This app demonstrates how to integrate Neon's authentication system with a modern Next.js 15+ application, including features like email OTP, social login (Google), organizations, and session management.

## Features

- 🔐 **Email OTP Authentication** - Passwordless login with email verification
- 🔗 **Social Login** - Google OAuth integration
- 👥 **Organizations** - Multi-tenant organization support
- 🎨 **Pre-built UI Components** - Beautiful, customizable auth views
- ⚡ **React Server Components** - Access session data in RSC
- 🌙 **Dark Mode Support** - Built-in theme support

## Setup Guide

Follow these steps to set up `@neondatabase/auth/next` in your Next.js project:

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

### 3. Set Up Proxy (Optional)

Create a `proxy.ts` file in your project root to proxy authentication requests to the Neon Auth server:

```typescript
// proxy.ts
import { neonAuthMiddleware } from '@neondatabase/auth/next/server';

export default neonAuthMiddleware()

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
```

### 4. Set Up the `/api/auth` Handlers

Create a catch-all API route to handle authentication requests:

```typescript
// app/api/auth/[...path]/route.ts
import { authApiHandler } from "@neondatabase/auth/next"

export const { GET, POST } = authApiHandler()
```

### 5. Set Up the Neon Auth UI Provider

Create the auth client and wrap your application with `NeonAuthUIProvider`:

**Create the auth client:**

```typescript
// lib/auth-client.ts
import { createAuthClient } from "@neondatabase/auth/next"

export const authClient = createAuthClient()
```

**Create the providers component:**

```tsx
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
            emailOTP
            social={{
                providers: ["google"]
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

**Wrap your layout:**

```tsx
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
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
```

### 6. Include CSS Styles

Import the Neon Auth UI styles in your global CSS file:

```css
/* app/globals.css */
@import "tailwindcss";
@import "@neondatabase/auth/ui/tailwind";
```

### 7. Create Auth Pages

**Auth Page (Sign In, Sign Up, etc.):**

```tsx
// app/auth/[path]/page.tsx
import { AuthView } from "@neondatabase/auth/react/ui"
import { authViewPaths } from "@neondatabase/auth/react/ui/server"

export const dynamicParams = false

export function generateStaticParams() {
    return Object.values(authViewPaths).map((path) => ({ path }))
}

export default async function AuthPage({ 
    params 
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

**Account Page:**

```tsx
// app/account/[path]/page.tsx
import { AccountView } from "@neondatabase/auth/react/ui"
import { accountViewPaths } from "@neondatabase/auth/react/ui/server"

export const dynamicParams = false

export function generateStaticParams() {
    return Object.values(accountViewPaths).map((path) => ({ path }))
}

export default async function AccountPage({ 
    params 
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

**Organization Page:**

```tsx
// app/organization/[path]/page.tsx
import { OrganizationView } from "@neondatabase/auth/react/ui"
import { organizationViewPaths } from "@neondatabase/auth/react/ui/server"

export const dynamicParams = false

export function generateStaticParams() {
    return Object.values(organizationViewPaths).map((path) => ({ path }))
}

export default async function OrganizationPage({ 
    params 
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

### 8. Accessing User & Session in React Server Components

Use the `neonAuth()` function to access session and user data in React Server Components:

```tsx
// app/components/session-card.tsx
import { neonAuth } from "@neondatabase/auth/next/server"

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
      {user.image && (
        <img src={user.image} alt="User avatar" />
      )}
    </div>
  )
}
```

### 9. Using the Auth Client in Client Components

For client components, use the `authClient.useSession()` hook:

```tsx
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
```

## Available Auth Routes

Once set up, the following routes are available:

- `/auth/sign-in` - Sign in page
- `/auth/sign-up` - Sign up page  
- `/auth/forgot-password` - Password reset request
- `/auth/reset-password` - Password reset form
- `/auth/verify-email` - Email verification
- `/auth/sign-out` - Sign out
- `/account/settings` - Account settings
- `/account/profile` - Profile management
- `/account/security` - Security settings
- `/organization/*` - Organization management

## Getting Started

1. Clone this repository
2. Install dependencies:

```bash
pnpm install
```

3. Set up your environment variables:

```bash
cp .env.example .env.local
# Edit .env.local with your Neon Auth URL
```

4. Run the development server:

```bash
pnpm dev
```

5. Open [http://localhost:3000](http://localhost:3000) to see the app.

## Learn More

- [Neon Auth Documentation](https://neon.tech/docs/guides/neon-auth)
- [Next.js Documentation](https://nextjs.org/docs)
- [Neon Database](https://neon.tech)

