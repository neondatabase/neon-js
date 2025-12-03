# @neondatabase/neon-auth-next

[![npm downloads](https://img.shields.io/npm/dm/@neondatabase/neon-auth-next.svg)](https://www.npmjs.com/package/@neondatabase/neon-auth-next)

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

### Add `neonAuthMiddleware` 

`neonAuthMiddleware()` helper protects your app routes with authentication. Export the `neonAuthMiddleware()` helper in your `proxy.ts` ()

```ts
import { neonAuthMiddleware } from "@neondatabase/neon-auth-next"

export default neonAuthMiddleware({
  loginUrl: "/auth/sign-in",  // Redirect to user to this page, if not authenticated
})

export const config = {
	matcher: [
    "/((?!_next/static|_next/image|favicon.ico|auth/*).*)", // Do not run the middleware for assets
    
    "/dashboard"  // Specify the routes the middleware applies to
    ],
};
```

 ### Create a Client

Create a client instance, that can be used in client components to sign up, sign in, and perform other auth related actions.

```ts
// lib/auth/client.ts

"use client"

import { createAuthClient } from '@neondatabase/neon-auth';

export const authClient =  createAuthClient({
   // Do not pass the baseURL here
})
```


### Server Actions

TBD