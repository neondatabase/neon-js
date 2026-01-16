# Neon Auth for React

Help developers set up @neondatabase/auth (authentication only, no database) in React applications with Vite, Create React App, or similar bundlers.

## When to Use

Use this skill when:
- Setting up auth-only in React (no database needed)
- User already has a database solution
- User mentions "@neondatabase/auth" without "neon-js"
- User is NOT using Next.js (use `neon-auth-nextjs` skill for Next.js)

## Critical Rules

1. **Adapter Factory Pattern**: Always call adapters with `()` - they are factory functions
2. **React Adapter Import**: Use subpath `@neondatabase/auth/react/adapters`
3. **createAuthClient takes URL as first arg**: `createAuthClient(url, config)`
4. **CSS Import**: Choose ONE - either `/ui/css` OR `/ui/tailwind`, never both

## Setup

### 1. Install
```bash
npm install @neondatabase/auth
```

### 2. Create Client (`src/auth-client.ts`)
```typescript
import { createAuthClient } from '@neondatabase/auth';
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters';

export const authClient = createAuthClient(
  import.meta.env.VITE_AUTH_URL,
  {
    adapter: BetterAuthReactAdapter(),
    // allowAnonymous: true, // Enable for RLS access without login
  }
);
```

### 3. Create Provider (`src/providers.tsx`)
```typescript
import { NeonAuthUIProvider } from '@neondatabase/auth/react/ui';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { authClient } from './auth-client';

// Import CSS (choose one)
import '@neondatabase/auth/ui/css';

export function Providers({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  return (
    <NeonAuthUIProvider
      authClient={authClient}
      navigate={navigate}
      redirectTo="/dashboard"
      Link={Link}
    >
      {children}
    </NeonAuthUIProvider>
  );
}
```

### 4. Wrap App (`src/main.tsx`)
```typescript
import { BrowserRouter } from 'react-router-dom';
import { Providers } from './providers';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Providers>
      <App />
    </Providers>
  </BrowserRouter>
);
```

---

## CSS & Styling

### Import Options

**Without Tailwind** (pre-built CSS bundle ~47KB):
```css
/* In your main CSS file or import in provider */
@import '@neondatabase/auth/ui/css';
```

**With Tailwind CSS v4**:
```css
@import 'tailwindcss';
@import '@neondatabase/auth/ui/tailwind';
```

**IMPORTANT**: Never import both - causes duplicate styles.

### Dark Mode

The provider includes `next-themes` for dark mode. Control via `defaultTheme` prop:

```typescript
<NeonAuthUIProvider
  authClient={authClient}
  defaultTheme="system" // 'light' | 'dark' | 'system'
  // ...
>
```

### Custom Theming

Override CSS variables in your stylesheet:
```css
:root {
  --primary: oklch(0.7 0.15 250);
  --primary-foreground: oklch(0.98 0 0);
  --background: oklch(1 0 0);
  --foreground: oklch(0.1 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.1 0 0);
  --border: oklch(0.9 0 0);
  --input: oklch(0.9 0 0);
  --ring: oklch(0.7 0 0);
  --radius: 0.5rem;
  /* See theme.css for full list */
}

.dark {
  --background: oklch(0.15 0 0);
  --foreground: oklch(0.98 0 0);
  /* Dark mode overrides */
}
```

---

## NeonAuthUIProvider Props

Full configuration options:

```typescript
<NeonAuthUIProvider
  // Required
  authClient={authClient}

  // Navigation (required for React Router)
  navigate={navigate}           // Router's navigate function
  Link={Link}                   // Router's Link component
  redirectTo="/dashboard"       // Where to redirect after auth

  // Social/OAuth Providers
  social={{
    providers: ['google', 'github', 'twitter', 'discord'],
  }}

  // Feature Flags
  emailOTP={true}               // Enable email OTP sign-in
  emailVerification={true}      // Require email verification
  magicLink={false}             // Magic link (disabled by default)
  multiSession={false}          // Multiple sessions (disabled)

  // Credentials Configuration
  credentials={{
    forgotPassword: true,       // Show forgot password link
  }}

  // Sign Up Fields
  signUp={{
    fields: ['name'],           // Additional fields: 'name', 'username', etc.
  }}

  // Account Settings Fields
  account={{
    fields: ['image', 'name', 'company', 'age', 'newsletter'],
  }}

  // Avatar Configuration
  avatar={{
    size: 256,
    extension: 'webp',
  }}

  // Organization Features
  organization={{}}             // Enable org features

  // Dark Mode
  defaultTheme="system"         // 'light' | 'dark' | 'system'

  // Custom Labels
  localization={{
    SIGN_IN: 'Welcome Back',
    SIGN_IN_DESCRIPTION: 'Sign in to your account',
    SIGN_UP: 'Create Account',
    SIGN_UP_DESCRIPTION: 'Join us today',
    FORGOT_PASSWORD: 'Forgot Password?',
    OR_CONTINUE_WITH: 'or continue with',
    // See better-auth-ui docs for full list
  }}
>
  {children}
</NeonAuthUIProvider>
```

---

## UI Components

### AuthView - Main Auth Interface

Handles sign-in, sign-up, forgot password, and callback routes:

```typescript
import { AuthView } from '@neondatabase/auth/react/ui';

// Route: /auth/:pathname
function AuthPage() {
  const { pathname } = useParams(); // 'sign-in', 'sign-up', 'forgot-password', etc.

  return <AuthView pathname={pathname} />;
}
```

**Supported pathnames**: `sign-in`, `sign-up`, `forgot-password`, `reset-password`, `callback`, `sign-out`

### Conditional Rendering

```typescript
import {
  SignedIn,
  SignedOut,
  AuthLoading,
  RedirectToSignIn
} from '@neondatabase/auth/react/ui';

function MyPage() {
  return (
    <>
      {/* Show while checking auth state */}
      <AuthLoading>
        <LoadingSpinner />
      </AuthLoading>

      {/* Show only when authenticated */}
      <SignedIn>
        <Dashboard />
      </SignedIn>

      {/* Show only when NOT authenticated */}
      <SignedOut>
        <LandingPage />
      </SignedOut>

      {/* Redirect to sign-in if not authenticated */}
      <RedirectToSignIn />
    </>
  );
}
```

### UserButton

Dropdown menu with user avatar, name, and sign-out:

```typescript
import { UserButton } from '@neondatabase/auth/react/ui';

function Header() {
  return (
    <header>
      <nav>...</nav>
      <UserButton />
    </header>
  );
}
```

### Account Management Components

```typescript
import {
  AccountSettingsCards,   // Profile info (avatar, name, email)
  SecuritySettingsCards,  // Security options (linked accounts)
  SessionsCard,           // Active sessions management
  ChangePasswordCard,     // Password change form
  ChangeEmailCard,        // Email change form
  DeleteAccountCard,      // Account deletion
  ProvidersCard,          // Linked OAuth providers
} from '@neondatabase/auth/react/ui';

function AccountPage() {
  const { view } = useParams(); // 'settings', 'security', 'sessions'

  return (
    <>
      <RedirectToSignIn />
      <SignedIn>
        {view === 'settings' && <AccountSettingsCards />}
        {view === 'security' && (
          <>
            <ChangePasswordCard />
            <SecuritySettingsCards />
          </>
        )}
        {view === 'sessions' && <SessionsCard />}
      </SignedIn>
    </>
  );
}
```

### Organization Components

```typescript
import {
  OrganizationSwitcher,       // Switch between orgs
  OrganizationSettingsCards,  // Org settings
  OrganizationMembersCard,    // Member management
  AcceptInvitationCard,       // Accept org invite
} from '@neondatabase/auth/react/ui';
```

---

## Adapter Options

### BetterAuthReactAdapter (Recommended for React)

Native Better Auth API with React hooks:

```typescript
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters';

const authClient = createAuthClient(url, {
  adapter: BetterAuthReactAdapter(),
});

// Methods
await authClient.signIn.email({ email, password });
await authClient.signUp.email({ email, password, name });
await authClient.signIn.social({ provider: 'google', callbackURL: '/dashboard' });
await authClient.signOut();
const session = await authClient.getSession();

// React Hook
const { data, isPending, error } = authClient.useSession();
```

### SupabaseAuthAdapter (Supabase-compatible API)

For migrating from Supabase or familiar API:

```typescript
import { SupabaseAuthAdapter } from '@neondatabase/auth/vanilla/adapters';

const authClient = createAuthClient(url, {
  adapter: SupabaseAuthAdapter(),
});

// Supabase-style methods
await authClient.signUp({ email, password, options: { data: { name } } });
await authClient.signInWithPassword({ email, password });
await authClient.signInWithOAuth({ provider: 'google', options: { redirectTo } });
await authClient.signOut();
const { data: session } = await authClient.getSession();

// Event listener
authClient.onAuthStateChange((event, session) => {
  console.log(event); // 'SIGNED_IN', 'SIGNED_OUT', 'TOKEN_REFRESHED', 'USER_UPDATED'
});
```

### BetterAuthVanillaAdapter (Non-React)

For vanilla JS/TS without React hooks:

```typescript
import { BetterAuthVanillaAdapter } from '@neondatabase/auth/vanilla/adapters';

const authClient = createAuthClient(url, {
  adapter: BetterAuthVanillaAdapter(),
});

// Same API as BetterAuthReactAdapter, but no useSession() hook
```

---

## Social/OAuth Providers

### Configuration

Enable providers in NeonAuthUIProvider:

```typescript
<NeonAuthUIProvider
  social={{
    providers: ['google', 'github', 'twitter', 'discord', 'apple', 'microsoft'],
  }}
>
```

### Programmatic OAuth Sign-In

```typescript
// BetterAuth API
await authClient.signIn.social({
  provider: 'google',
  callbackURL: '/dashboard',
  scopes: ['email', 'profile'], // Optional
});

// Supabase API
await authClient.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: '/dashboard',
    scopes: 'email profile',
  },
});
```

### Supported Providers

`google`, `github`, `twitter`, `discord`, `apple`, `microsoft`, `facebook`, `linkedin`, `spotify`, `twitch`, `gitlab`, `bitbucket`

### OAuth in Iframes

OAuth automatically uses popup flow when running in iframes (due to X-Frame-Options restrictions). No configuration needed.

---

## Session Hook

```typescript
function MyComponent() {
  const { data: session, isPending, error, refetch } = authClient.useSession();

  if (isPending) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!session) return <div>Not signed in</div>;

  return (
    <div>
      <p>Hello, {session.user.name}</p>
      <p>Email: {session.user.email}</p>
      <p>ID: {session.user.id}</p>
      <img src={session.user.image} alt="Avatar" />
    </div>
  );
}
```

**Session object shape:**
```typescript
{
  user: {
    id: string;
    email: string;
    name: string;
    image?: string;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  session: {
    id: string;
    token: string;        // JWT token
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  };
}
```

---

## Advanced Features

### Anonymous Access

Enable RLS-based data access for unauthenticated users:

```typescript
// Client setup
const authClient = createAuthClient(url, {
  adapter: BetterAuthReactAdapter(),
  allowAnonymous: true,
});

// Get token (returns anonymous JWT if not signed in)
const token = await authClient.getJWTToken?.();
```

### Get JWT Token (for API calls)

```typescript
const token = await authClient.getJWTToken();

const response = await fetch('/api/data', {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

### Password Reset Flow

```typescript
// 1. Request reset email (Supabase API)
await authClient.resetPasswordForEmail(email, {
  redirectTo: '/auth/reset-password',
});

// 2. User clicks link, lands on reset page
// 3. Verify OTP and set new password
await authClient.verifyOtp({
  email,
  token: otpFromUrl,
  type: 'recovery',
});

// Then call password update
await authClient.updateUser({ password: newPassword });
```

### Update User Profile

```typescript
// BetterAuth API
await authClient.updateUser({
  name: 'New Name',
  image: 'https://...',
  // Custom fields defined in account.fields
});

// Supabase API
await authClient.updateUser({
  data: {
    name: 'New Name',
    avatar_url: 'https://...',
  },
});
```

### Identity/Account Linking

```typescript
// List linked accounts
const { data } = await authClient.getUserIdentities();
// Returns: { identities: [{ provider: 'google', ... }] }

// Link new provider
await authClient.linkIdentity({
  provider: 'github',
  options: { redirectTo: '/account/security' },
});

// Unlink provider
await authClient.unlinkIdentity({
  identity_id: 'identity-uuid',
});
```

### Auth State Events (Supabase Adapter)

```typescript
const { data: { subscription } } = authClient.onAuthStateChange((event, session) => {
  switch (event) {
    case 'SIGNED_IN':
      console.log('User signed in:', session?.user);
      break;
    case 'SIGNED_OUT':
      console.log('User signed out');
      break;
    case 'TOKEN_REFRESHED':
      console.log('Token refreshed');
      break;
    case 'USER_UPDATED':
      console.log('User profile updated');
      break;
  }
});

// Cleanup
subscription.unsubscribe();
```

### Cross-Tab Synchronization

Automatic via BroadcastChannel. Sign out in one tab signs out all tabs.

---

## Protected Routes

### Pattern with React Router

```typescript
// routes.tsx
import { Routes, Route } from 'react-router-dom';

export function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<HomePage />} />

      {/* Auth routes */}
      <Route path="/auth/:pathname" element={<AuthPage />} />

      {/* Protected */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/account/:view?" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
    </Routes>
  );
}

// ProtectedRoute.tsx
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthLoading>
        <LoadingSpinner />
      </AuthLoading>
      <RedirectToSignIn />
      <SignedIn>
        {children}
      </SignedIn>
    </>
  );
}
```

### Auth Page Setup

```typescript
// pages/AuthPage.tsx
import { useParams } from 'react-router-dom';
import { AuthView } from '@neondatabase/auth/react/ui';

export function AuthPage() {
  const { pathname } = useParams();
  return <AuthView pathname={pathname} />;
}
```

### Account Page Setup

```typescript
// pages/AccountPage.tsx
import { useParams } from 'react-router-dom';
import {
  SignedIn,
  RedirectToSignIn,
  AccountSettingsCards,
  SecuritySettingsCards,
  SessionsCard,
  ChangePasswordCard,
} from '@neondatabase/auth/react/ui';

export function AccountPage() {
  const { view = 'settings' } = useParams();

  return (
    <>
      <RedirectToSignIn />
      <SignedIn>
        {view === 'settings' && <AccountSettingsCards />}
        {view === 'security' && (
          <>
            <ChangePasswordCard />
            <SecuritySettingsCards />
          </>
        )}
        {view === 'sessions' && <SessionsCard />}
      </SignedIn>
    </>
  );
}
```

---

## Error Handling

### Error Response Shape

```typescript
const result = await authClient.signIn.email({ email, password });

if (result.error) {
  console.error(result.error.message);  // Human-readable message
  console.error(result.error.status);   // HTTP status code
}
```

### Common Errors

| Error | Cause |
|-------|-------|
| `Invalid credentials` | Wrong email/password |
| `User already exists` | Email already registered |
| `Email not verified` | Verification required |
| `Session not found` | Expired or invalid session |
| `Rate limited` | Too many requests |

### Try-Catch Pattern

```typescript
try {
  const { error } = await authClient.signIn.email({ email, password });

  if (error) {
    // Handle auth-specific errors
    toast.error(error.message);
    return;
  }

  // Success - redirect
  navigate('/dashboard');
} catch (err) {
  // Handle network/unexpected errors
  toast.error('Something went wrong');
}
```

---

## Performance Notes

- **Session caching**: 60-second TTL, automatic JWT expiration handling
- **Request deduplication**: Concurrent calls share single network request
- **Cold start**: ~200ms (single request)
- **Cross-tab sync**: <50ms via BroadcastChannel

---

## FAQ / Troubleshooting

### Anonymous access not working?

When using `allowAnonymous: true`, you must grant permissions to the `anonymous` role in your database:

```sql
-- Grant SELECT on specific tables
GRANT SELECT ON public.posts TO anonymous;
GRANT SELECT ON public.products TO anonymous;

-- Or grant on all tables in schema (be careful!)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anonymous;

-- For INSERT/UPDATE/DELETE (if needed)
GRANT INSERT, UPDATE ON public.comments TO anonymous;
```

Your RLS policies must also allow the anonymous role:

```sql
-- Example: Allow anonymous users to read published posts
CREATE POLICY "Anyone can read published posts"
  ON public.posts FOR SELECT
  USING (published = true);

-- Example: Allow anonymous users to read products
CREATE POLICY "Anyone can read products"
  ON public.products FOR SELECT
  USING (true);
```

### OAuth redirect not working in iframe?

OAuth automatically uses popup flow in iframes. Make sure:
1. Your auth server allows the popup callback URL
2. Popups aren't blocked by the browser

### Session not persisting after refresh?

Check that:
1. Cookies are enabled
2. Your auth server URL matches your domain (or has proper CORS)
3. You're not in incognito mode with cookies blocked

### "Invalid credentials" but password is correct?

- Email might not be verified (check `emailVerification` setting)
- Account might be locked after too many failed attempts
- Check if using correct adapter API (Supabase vs BetterAuth style)
