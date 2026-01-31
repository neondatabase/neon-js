---
name: neon-auth
description: |
  Add, configure, modify, or troubleshoot Neon Auth (@neondatabase/auth) in any project.
  Use this skill when: integrating Neon Auth, fixing auth errors, updating auth configuration,
  adding social providers, debugging login/session issues, or any task involving @neondatabase/auth.
---

# Neon Auth

Help developers set up `@neondatabase/auth` (authentication only, no database) in JavaScript/TypeScript applications.

## When to Use

Use this skill when:
- Setting up Neon Auth in any JS/TS application
- User mentions "@neondatabase/auth" without "neon-js"
- Auth-only setup (no database needed)

**Framework-specific references:**
- React (Vite, CRA) → See [setup-react-spa.md](references/setup-react-spa.md)
- Next.js App Router → See [setup-nextjs.md](references/setup-nextjs.md)

## Critical Rules

1. **Adapter Factory Pattern**: Always call adapters with `()` - they are factory functions
   ```typescript
   // CORRECT
   adapter: BetterAuthReactAdapter()

   // WRONG - missing ()
   adapter: BetterAuthReactAdapter
   ```

2. **React Adapter Import**: Use subpath `@neondatabase/auth/react/adapters`
   ```typescript
   import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters';
   ```

3. **createAuthClient takes URL first**: `createAuthClient(url, config)`
   ```typescript
   createAuthClient('https://auth.example.com', { adapter: ... })
   ```

4. **CSS Import**: Choose ONE - either `/ui/css` OR `/ui/tailwind`, never both

5. **Next.js onSessionChange**: Always call `router.refresh()` to update Server Components

## Import Cheat Sheet

| Purpose | Import From |
|---------|-------------|
| **Factory** | `@neondatabase/auth` |
| **React Adapter** | `@neondatabase/auth/react/adapters` |
| **Vanilla Adapters** | `@neondatabase/auth/vanilla/adapters` |
| **UI Components** | `@neondatabase/auth/react/ui` |
| **UI Server Utils** | `@neondatabase/auth/react/ui/server` |
| **Next.js Client** | `@neondatabase/auth/next` |
| **Next.js Server** | `@neondatabase/auth/next/server` |
| **Pre-built CSS** | `@neondatabase/auth/ui/css` |
| **Tailwind CSS** | `@neondatabase/auth/ui/tailwind` |
| **Types** | `@neondatabase/auth/types` |

---

## Building Auth Pages

### Use AuthView (Recommended for React Apps)

For authentication pages, use the pre-built `AuthView` component instead of building custom forms.

**What AuthView provides:**
- Sign-in, sign-up, password reset, magic link pages
- Social providers (Google, GitHub) - requires TWO configurations: enable in Neon Console AND add `social` prop to NeonAuthUIProvider
- Form validation, error handling, loading states
- Consistent styling via CSS variables

**Setup (Next.js App Router):**

1. **Import CSS** (in `app/layout.tsx` or `app/globals.css`):
```tsx
import "@neondatabase/auth/ui/css";
```

2. **Wrap app with provider** (create `app/auth-provider.tsx`):
```tsx
"use client";
import { NeonAuthUIProvider } from "@neondatabase/auth/react/ui";
import { authClient } from "@/lib/auth/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <NeonAuthUIProvider
      authClient={authClient}
      navigate={router.push}
      replace={router.replace}
      onSessionChange={() => router.refresh()}
      Link={Link}
    >
      {children}
    </NeonAuthUIProvider>
  );
}
```

3. **Create auth page** (`app/auth/[path]/page.tsx`):
```tsx
import { AuthView } from "@neondatabase/auth/react/ui";
import { authViewPaths } from "@neondatabase/auth/react/ui/server";

export function generateStaticParams() {
  return Object.values(authViewPaths).map((path) => ({ path }));
}

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;
  return <AuthView pathname={path} />;
}
```

**Result:** You now have `/auth/sign-in`, `/auth/sign-up`, `/auth/forgot-password`, etc.

**Available paths:** `"sign-in"`, `"sign-up"`, `"forgot-password"`, `"reset-password"`, `"magic-link"`, `"two-factor"`, `"callback"`, `"sign-out"`

### When to Use Low-Level Methods Instead

Use `authClient.signIn.email()`, `authClient.signUp.email()` directly if:

- **Node.js backend** - No React, server-side auth only
- **Custom design system** - Your design team provides form components
- **Mobile/CLI apps** - Non-web frontends
- **Headless auth** - Testing or non-standard flows

For standard React web apps, **use AuthView**.

### Common Anti-Pattern

```tsx
// ❌ Don't build custom forms unless you have specific requirements
function CustomSignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await authClient.signIn.email({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  // ... 50+ more lines of form JSX, validation, error display
}

// ✅ Use AuthView instead - one component handles everything
<AuthView pathname="sign-in" />;
```

---

## Quick Start: React

```bash
npm install @neondatabase/auth
```

**1. Create Client** (`src/auth-client.ts`)
```typescript
import { createAuthClient } from '@neondatabase/auth';
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters';

export const authClient = createAuthClient(
  import.meta.env.VITE_NEON_AUTH_URL,
  { adapter: BetterAuthReactAdapter() }
);
```

**2. Create Provider** (`src/providers.tsx`)
```typescript
import { NeonAuthUIProvider } from '@neondatabase/auth/react/ui';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { authClient } from './auth-client';
import '@neondatabase/auth/ui/css';

function Link({ href, ...props }: { href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <RouterLink to={href} {...props} />;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <NeonAuthUIProvider
      authClient={authClient}
      navigate={(path) => navigate(path)}
      replace={(path) => navigate(path, { replace: true })}
      Link={Link}
      social={{ providers: ['google', 'github'] }}
    >
      {children}
    </NeonAuthUIProvider>
  );
}
```

**3. Wrap App** (`src/main.tsx`)
```typescript
import { BrowserRouter } from 'react-router-dom';
import { Providers } from './providers';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Providers><App /></Providers>
  </BrowserRouter>
);
```

**4. Auth Page** (`src/pages/AuthPage.tsx`)
```typescript
import { useParams } from 'react-router-dom';
import { AuthView } from '@neondatabase/auth/react/ui';

export function AuthPage() {
  const { pathname } = useParams();
  return <AuthView pathname={pathname} />;
}
```

→ Full setup: [setup-react-spa.md](references/setup-react-spa.md)

---

## Quick Start: Next.js

```bash
npm install @neondatabase/auth
```

**1. Environment** (`.env.local`)
```
NEON_AUTH_BASE_URL=https://ep-xxx.neonauth.c-2.us-east-2.aws.neon.build/dbname/auth
NEXT_PUBLIC_NEON_AUTH_URL=https://ep-xxx.neonauth.c-2.us-east-2.aws.neon.build/dbname/auth
```

**2. API Route** (`app/api/auth/[...path]/route.ts`)
```typescript
import { authApiHandler } from '@neondatabase/auth/next';
export const { GET, POST } = authApiHandler();
```

**3. Middleware** (`middleware.ts`)
```typescript
import { neonAuthMiddleware } from '@neondatabase/auth/next/server';

export default neonAuthMiddleware({ loginUrl: '/auth/sign-in' });
export const config = { matcher: ['/dashboard/:path*', '/account/:path*'] };
```

**4. Client** (`lib/auth/client.ts`)
```typescript
'use client';
import { createAuthClient } from '@neondatabase/auth/next';
export const authClient = createAuthClient();
```

**5. Provider** (`app/providers.tsx`)
```typescript
'use client';
import { NeonAuthUIProvider } from '@neondatabase/auth/react/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <NeonAuthUIProvider
      authClient={authClient}
      navigate={router.push}
      replace={router.replace}
      onSessionChange={() => router.refresh()}
      Link={Link}
      social={{ providers: ['google', 'github'] }}
    >
      {children}
    </NeonAuthUIProvider>
  );
}
```

**6. Layout** (`app/layout.tsx`)
```typescript
import { Providers } from './providers';
import '@neondatabase/auth/ui/css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
```

**7. Auth Page** (`app/auth/[path]/page.tsx`)
```typescript
import { AuthView } from '@neondatabase/auth/react/ui';
import { authViewPaths } from '@neondatabase/auth/react/ui/server';

export function generateStaticParams() {
  return Object.values(authViewPaths).map((path) => ({ path }));
}

export default async function AuthPage({ params }: { params: Promise<{ path: string }> }) {
  const { path } = await params;
  return <AuthView pathname={path} />;
}
```

→ Full setup: [setup-nextjs.md](references/setup-nextjs.md)

---

## Auth Methods

### Sign Up

```typescript
await auth.signUp.email({
  email: "user@example.com",
  password: "securepassword",
  name: "John Doe", // Optional
});
```

### Sign In

```typescript
// Email/password
await auth.signIn.email({
  email: "user@example.com",
  password: "securepassword",
});

// Social (Google, GitHub)
await auth.signIn.social({
  provider: "google", // or "github"
  callbackURL: "/dashboard",
});
```

### Sign Out

```typescript
await auth.signOut();
```

### Get Session

```typescript
// Async (Node.js, server components)
const session = await auth.getSession();

// React hook (client components)
const session = auth.useSession();
// Returns: { data: Session | null, isPending: boolean }
```

---

## Session Data Structure

```typescript
interface Session {
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  session: {
    id: string;
    expiresAt: Date;
    token: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
  };
}
```

---

## Error Handling

```typescript
const { error } = await auth.signIn.email({ email, password });

if (error) {
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      showError("Invalid email or password");
      break;
    case "EMAIL_NOT_VERIFIED":
      showError("Please verify your email");
      break;
    case "USER_NOT_FOUND":
      showError("User not found");
      break;
    case "TOO_MANY_REQUESTS":
      showError("Too many attempts. Please wait.");
      break;
    default:
      showError("Authentication failed");
  }
}
```

---

## CSS & Theming

### Import Options

**Without Tailwind** (~47KB pre-built):
```css
@import '@neondatabase/auth/ui/css';
```

**With Tailwind CSS v4**:
```css
@import 'tailwindcss';
@import '@neondatabase/auth/ui/tailwind';
```

### Automatic Theme Inheritance

Neon Auth UI **automatically inherits your app's existing theme**. If you have CSS variables like `--primary`, `--background`, etc. defined (from Tailwind, shadcn/ui, or custom CSS), auth components use them with no configuration.

**Key features:**
- **Automatic inheritance**: Uses your existing `--primary`, `--background`, etc.
- **No conflicts**: Auth styles are in `@layer neon-auth`, so your styles always win
- **Import order doesn't matter**: CSS layers handle priority automatically

### CSS Variables Reference

| Variable                            | Purpose                 |
| ----------------------------------- | ----------------------- |
| `--background`, `--foreground`      | Page background/text    |
| `--card`, `--card-foreground`       | Card surfaces           |
| `--primary`, `--primary-foreground` | Primary buttons/actions |
| `--muted`, `--muted-foreground`     | Muted/subtle elements   |
| `--border`, `--ring`                | Borders and focus rings |
| `--radius`                          | Border radius           |

### Auth-Specific Customization

To customize auth components differently from your main app, use `--neon-*` prefix:

```css
:root {
  --primary: oklch(0.55 0.25 250); /* Your app's blue */
  --neon-primary: oklch(0.55 0.18 145); /* Auth uses green */
}
```

---

## UI Components Quick Reference

| Component | Purpose |
|-----------|---------|
| `AuthView` | Sign-in/up/forgot-password pages |
| `SignedIn` / `SignedOut` | Conditional rendering |
| `AuthLoading` | Loading state |
| `RedirectToSignIn` | Auto-redirect |
| `UserButton` | User avatar dropdown |

```typescript
import {
  AuthView,
  SignedIn,
  SignedOut,
  AuthLoading,
  RedirectToSignIn,
  UserButton,
} from '@neondatabase/auth/react/ui';
```

→ Full list: [ui-components.md](references/ui-components.md)

---

## Social Login Configuration

**Important:** Social providers require TWO configurations:
1. **Enable in Neon Console** - Go to your project's Auth settings
2. **Add to NeonAuthUIProvider** - Pass `social` prop

```typescript
<NeonAuthUIProvider
  authClient={authClient}
  social={{ providers: ['google', 'github'] }}
>
```

Without both configurations, social login buttons won't appear.

Supported: `google`, `github`, `twitter`, `discord`, `apple`, `microsoft`, `facebook`, `linkedin`

---

## Common Issues

### OAuth not working in iframe?
OAuth auto-uses popup flow in iframes. Ensure popups aren't blocked.

### Session not persisting?
1. Cookies enabled?
2. Auth URL matches domain (or CORS configured)?
3. Not incognito with cookies blocked?

### Next.js Server Components not updating?
Add `onSessionChange={() => router.refresh()}` to provider.

→ More: [common-mistakes.md](references/common-mistakes.md)

---

## References

- [setup-react-spa.md](references/setup-react-spa.md) - Complete React SPA setup
- [setup-nextjs.md](references/setup-nextjs.md) - Complete Next.js setup
- [auth-methods.md](references/auth-methods.md) - Auth methods reference
- [ui-components.md](references/ui-components.md) - UI components with props
- [common-mistakes.md](references/common-mistakes.md) - Common mistakes and fixes
