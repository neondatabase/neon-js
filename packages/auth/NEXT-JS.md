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