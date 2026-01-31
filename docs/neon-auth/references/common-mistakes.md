# Neon Auth - Common Mistakes

Reference guide for common mistakes when using `@neondatabase/auth` or `@neondatabase/neon-js`.

## Import Mistakes

### BetterAuthReactAdapter Subpath Requirement

`BetterAuthReactAdapter` is **NOT** exported from the main package entry. You must import it from the subpath.

**Wrong:**

```typescript
// These will NOT work
import { BetterAuthReactAdapter } from "@neondatabase/neon-js";
import { BetterAuthReactAdapter } from "@neondatabase/auth";
```

**Correct:**

```typescript
// For @neondatabase/neon-js
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters";

// For @neondatabase/auth
import { BetterAuthReactAdapter } from "@neondatabase/auth/react/adapters";
```

**Why:** The React adapter has React-specific dependencies and is tree-shaken out of the main bundle. Using subpath exports keeps the main bundle smaller for non-React environments.

### Adapter Factory Functions

All adapters are **factory functions** that must be called with `()`.

**Wrong:**

```typescript
const client = createClient({
  auth: {
    adapter: BetterAuthReactAdapter, // Missing ()
    url: process.env.NEON_AUTH_URL!,
  },
  dataApi: { url: process.env.NEON_DATA_API_URL! },
});
```

**Correct:**

```typescript
const client = createClient({
  auth: {
    adapter: BetterAuthReactAdapter(), // Called as function
    url: process.env.NEON_AUTH_URL!,
  },
  dataApi: { url: process.env.NEON_DATA_API_URL! },
});
```

This applies to all adapters:

- `BetterAuthReactAdapter()`
- `BetterAuthVanillaAdapter()`
- `SupabaseAuthAdapter()`

---

## CSS Import Mistakes

Auth UI components require CSS. Choose **ONE** method based on your project.

### With Tailwind v4

```css
/* In app/globals.css */
@import "tailwindcss";
@import "@neondatabase/neon-js/ui/tailwind";
/* Or: @import '@neondatabase/auth/ui/tailwind'; */
```

### Without Tailwind

```typescript
// In app/layout.tsx
import "@neondatabase/neon-js/ui/css";
// Or: import "@neondatabase/auth/ui/css";
```

### Never Import Both

**Wrong:**

```css
/* Causes ~94KB of duplicate styles */
@import "@neondatabase/neon-js/ui/css";
@import "@neondatabase/neon-js/ui/tailwind";
```

**Why:** The `ui/css` import includes pre-built CSS (~47KB). The `ui/tailwind` import provides Tailwind tokens (~2KB) that generate similar styles. Using both doubles your CSS bundle.

---

## Configuration Mistakes

### Wrong createAuthClient Signature

The `createAuthClient` function takes the URL as the first argument, not as a property in an options object.

**Wrong:**

```typescript
// This will NOT work
createAuthClient({ baseURL: url });
createAuthClient({ url: myUrl });
```

**Correct:**

```typescript
// Vanilla client - URL as first arg
createAuthClient(url);

// With adapter - URL as first arg, options as second
createAuthClient(url, { adapter: BetterAuthReactAdapter() });

// Next.js client - no arguments (uses env vars automatically)
import { createAuthClient } from "@neondatabase/auth/next";
const authClient = createAuthClient();
```

### Missing Environment Variables

**Required for Next.js:**

```bash
# .env.local
NEON_AUTH_BASE_URL=https://ep-xxx.neonauth.c-2.us-east-2.aws.neon.build/dbname/auth
NEXT_PUBLIC_NEON_AUTH_URL=https://ep-xxx.neonauth.c-2.us-east-2.aws.neon.build/dbname/auth

# For neon-js (auth + data)
NEON_DATA_API_URL=https://ep-xxx.apirest.c-2.us-east-2.aws.neon.build/dbname/rest/v1
```

**Required for Vite/React SPA:**

```bash
# .env
VITE_NEON_AUTH_URL=https://ep-xxx.neonauth.c-2.us-east-2.aws.neon.build/dbname/auth
VITE_NEON_DATA_API_URL=https://ep-xxx.apirest.c-2.us-east-2.aws.neon.build/dbname/rest/v1
```

**Important:**

- `NEON_AUTH_BASE_URL` - Server-side auth
- `NEXT_PUBLIC_*` prefix - Required for client-side access in Next.js
- `VITE_*` prefix - Required for client-side access in Vite
- Restart dev server after adding env vars

---

## Usage Mistakes

### Missing "use client" Directive

Client components using `useSession()` need the `"use client"` directive.

**Wrong:**

```typescript
// Missing directive - will cause hydration errors
import { authClient } from "@/lib/auth/client";

function AuthStatus() {
  const session = authClient.useSession();
  // ...
}
```

**Correct:**

```typescript
"use client";

import { authClient } from "@/lib/auth/client";

function AuthStatus() {
  const session = authClient.useSession();
  // ...
}
```

### Next.js Server Components Not Updating

Server Components cache on the server. After client-side sign-in/out, RSC won't re-render unless you call `router.refresh()`:

**Wrong:**

```typescript
<NeonAuthUIProvider
  authClient={authClient}
  navigate={router.push}
  // Missing onSessionChange
>
```

**Correct:**

```typescript
<NeonAuthUIProvider
  authClient={authClient}
  navigate={router.push}
  onSessionChange={() => router.refresh()} // Critical for RSC!
>
```

---

## Social Login Mistakes

### Social Buttons Not Appearing

Social providers require **TWO** configurations:

1. **Enable in Neon Console** - Go to your project's Auth settings and enable the provider
2. **Add to NeonAuthUIProvider** - Pass the `social` prop

**Wrong (missing social prop):**

```typescript
<NeonAuthUIProvider authClient={authClient}>
  {children}
</NeonAuthUIProvider>
```

**Correct:**

```typescript
<NeonAuthUIProvider
  authClient={authClient}
  social={{ providers: ['google', 'github'] }}
>
  {children}
</NeonAuthUIProvider>
```

Even if enabled in the Neon Console, social buttons won't appear without the `social` prop.

---

## Session Persistence Issues

### Cookies Not Working

Check these common causes:

1. **Cookies disabled** - Check browser settings
2. **Cross-origin issues** - Auth URL must match your domain or have CORS configured
3. **Incognito mode** - Some browsers block cookies in incognito
4. **Secure cookies on HTTP** - In production, cookies require HTTPS

### OAuth Not Working in Iframe

OAuth providers block redirects in iframes due to X-Frame-Options/CSP restrictions. Neon Auth automatically detects this and uses a popup flow instead.

**If popup is blocked:**

1. Ensure popups aren't blocked by the browser
2. The SDK shows a prompt to retry with popup
3. Consider not embedding auth in iframes
