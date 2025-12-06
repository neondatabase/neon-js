# @neondatabase/auth/next

[![npm downloads](https://img.shields.io/npm/dm/@neondatabase/auth.svg)](https://www.npmjs.com/package/@neondatabase/auth)

### Install the dependencies

```shell
npm install @neondatabase/auth
```


### Create an Auth Handler 

To integrate Neon Auth with Next.js, we need to mount the auth handler to an API route. Create a route file inside `/api/auth/[...path]` directory and add the following code: 

```ts
// api/auth/[...path]/route.ts
import { toNextJsHandler } from "@neondatabase/auth/next"

export const { GET, POST } = toNextJsHandler(
  process.env.NEON_AUTH_BASE_URL
)
```


### Create a Client

Create a client instance, that can be used in client components to sign up, sign in, and perform other auth related actions.

```ts
// lib/auth/client.ts
"use client"

import { createAuthClient } from '@neondatabase/auth/next';

export const authClient =  createAuthClient()
```

### Use Neon Auth UI Provider

Setup `AuthProvider` in Root Layout to provide `authClient` to UI components from `@neondatabase/auth/react/ui`

```typescript
// app/provider.tsx
'use client';

import { NeonAuthUIProvider } from '@neondatabase/auth/react/ui';
import { authClient } from '@/lib/auth/client';
import Link from "next/link"
import { useRouter } from "next/navigation"

export function AuthProvider({ children }: { children: React.ReactNode }) {
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
      social={{
        providers: ["google"]
      }}
      Link={Link}
    >
      {children}
    </NeonAuthUIProvider>
  );
}
```

Then wrap your app with the provider:

```typescript
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
```

### Add Auth Pages

Create a dynamic route file at `app/auth/[path]/page.tsx` to handle all authentication views:

```typescript
// app/auth/[path]/page.tsx
import { AuthView } from "@neondatabase/auth/react/ui"
import { authViewPaths } from "@neondatabase/auth/react/ui/server"

export const dynamicParams = false

export function generateStaticParams() {
    return Object.values(authViewPaths).map((path) => ({ path }))
}

export default async function AuthPage({ params }: { params: Promise<{ path: string }> }) {
    const { path } = await params

    return (
        <main className="container flex grow flex-col items-center justify-center self-center p-4 md:p-6">
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

For advanced configuration options and to learn more about the UI library, see the [better-auth-ui documentation](https://better-auth-ui.com/integrations/next-js).


### Don't forget to import styles

Choose the import method based on your project setup:

#### Option A: Without Tailwind CSS (recommended for most users)

If your project doesn't use Tailwind CSS, import the pre-built CSS bundle:

```typescript
// In your root layout or app entry point
import '@neondatabase/auth/ui/css';
```

This includes all necessary styles with no additional configuration required.

#### Option B: With Tailwind CSS

If your project already uses Tailwind CSS v4, import the Tailwind-ready CSS to avoid duplicate styles:

```css
/* In your main CSS file (e.g., globals.css, app.css) */
@import 'tailwindcss';
@import '@neondatabase/auth/ui/tailwind';
```

This imports only the theme variables and component scanning directive. Your Tailwind build will generate the necessary utility classes, avoiding duplication with your existing Tailwind setup.


### Server Actions

TBD