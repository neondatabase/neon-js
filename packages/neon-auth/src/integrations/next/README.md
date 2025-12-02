### Neon Auth Nextjs

### Create a Auth 

To integrate Neon Auth with Next.js, we need to mount the auth handler to an API route. Create a route file
 inside `/api/auth/[...path]` directory and add the following code: 

 ```ts
// api/auth/[...path]/route.ts

import { toNextJsHandler } from "@neondatabase/neon-auth/next"

export const { GET, POST } = toNextJsHandler(
  process.env.NEON_AUTH_BASE_URL
)
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


 