# @neondatabase/neon-auth-next

[![npm downloads](https://img.shields.io/npm/dm/@neondatabase/neon-auth-next.svg)](https://www.npmjs.com/package/@neondatabase/neon-auth-next)

### Install the dependencies

```shell
npm install @neondatabase/neon-auth-next @neondatabase/neon-auth-ui
```

### Create an Auth Handler 

To integrate Neon Auth with Next.js, we need to mount the auth handler to an API route. Create a route file
 inside `/api/auth/[...path]` directory and add the following code: 

```ts
// api/auth/[...path]/route.ts

import { toNextJsHandler } from "@neondatabase/neon-auth-next"

export const { GET, POST } = toNextJsHandler(
  process.env.NEON_AUTH_BASE_URL
)
```


 ### Create a Client

Create a client instance, that can be used in client components to sign up, sign in, and perform other auth related actions.

```ts
// lib/auth/client.ts

"use client"

import { createAuthClient } from '@neondatabase/neon-auth-next';

export const authClient =  createAuthClient()
```

### Use Neon Auth UI Provider

Setup `AuthProvider` in Root Layout to provide `authClient` to UI components from [@neondatabase/neon-auth-ui](https://www.npmjs.com/package/@neondatabase/neon-auth-ui)

```typescript
// app/provider.tsx
'use client';

import { NeonAuthUIProvider } from '@neondatabase/neon-auth-ui';
import { authClient } from '@/lib/client';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <NeonAuthUIProvider 
      authClient={authClient}
      redirectTo="/dashboard"
      social={{
        providers: ["google"]
      }}
    >
      {children}
    </NeonAuthUIProvider>
  );
}

// app/layout.tsx

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider> {children} </AuthProvider>
      </body>
    </html>
  )
}
```

Do not forget to import styles as well

```css
@import 'tailwindcss';
@import '@neondatabase/neon-auth-ui/tailwind';
```


### Server Actions

TBD