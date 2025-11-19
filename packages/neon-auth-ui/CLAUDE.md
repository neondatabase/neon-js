# Neon Auth UI

A React UI component library for authentication built on the Supabase-compatible `AuthClient` interface. This package works with any auth provider that implements Supabase's auth API, including `@neondatabase/neon-auth`.

## Architecture

### Design Principles

1. **Provider Agnostic**: Works with Supabase, neon-auth adapters, or any Supabase-compatible auth client
2. **Core Features Only**: Focuses on universal auth features (sign in/up, password reset, OAuth)
3. **Custom Hooks**: Built-in React hooks manage auth state using Supabase API
4. **Feature Detection**: Components gracefully handle missing features

### Package Structure

```
packages/neon-auth-ui/
├── src/
│   ├── components/
│   │   ├── auth/              # Authentication UI (forms, callbacks, views)
│   │   ├── account/           # Account management UI
│   │   ├── settings/          # Settings pages (security, account)
│   │   ├── ui/               # Reusable UI primitives (from shadcn/ui)
│   │   ├── user-avatar.tsx   # User avatar display
│   │   ├── user-button.tsx   # User menu dropdown
│   │   └── signed-in/out.tsx # Auth state conditional rendering
│   │
│   ├── hooks/
│   │   ├── use-session.ts     # Session management hook (NEW)
│   │   ├── use-auth-data.ts   # Generic data fetching with caching
│   │   └── use-authenticate.ts# Authentication redirect hook
│   │
│   ├── lib/
│   │   ├── auth-ui-provider.tsx # Context provider for auth data
│   │   ├── auth-data-cache.ts   # Client-side caching for auth data
│   │   └── social-providers.ts  # OAuth provider configuration
│   │
│   ├── types/
│   │   ├── any-auth-client.ts   # AnyAuthClient = AuthClient
│   │   ├── auth-client.ts       # Re-export Supabase types
│   │   ├── auth-hooks.ts        # AuthHooks interface (simplified)
│   │   └── auth-mutators.ts     # AuthMutators interface (simplified)
│   │
│   └── index.ts               # Main exports
│
└── README.md                   # Usage documentation
```

### Integration Flow

```
User's App
    ↓
AuthUIProvider (provides authClient, hooks, mutators)
    ↓
Components (AuthView, AccountView, UserButton, etc.)
    ↓
Hooks (useSession, useAuthData, useAuthenticate)
    ↓
AuthClient (Supabase-compatible interface)
    ↓
Adapter (e.g., BetterAuthAdapter from @neondatabase/neon-auth)
    ↓
Auth Service (Better Auth backend, Supabase, etc.)
```

## Key Concepts

### Supabase-Compatible Interface

The `AuthClient` interface (from `@supabase/auth-js`) provides:

```typescript
interface AuthClient {
  // Authentication
  signUp(credentials) -> { data, error }
  signInWithPassword(credentials) -> { data, error }
  signInWithOAuth(provider, options) -> { error }
  signInWithOtp(email, options) -> { error }
  signOut() -> { error }

  // Session Management
  getSession() -> { data: { session, user }, error }
  onAuthStateChange(callback) -> { data: { subscription } }

  // User Management
  updateUser(updates) -> { data, error }
  getUserIdentities() -> { data: Identity[], error }

  // Account Linking
  linkIdentity(provider, options) -> { error }
  unlinkIdentity(identity_id) -> { data, error }

  // Password
  resetPasswordForEmail(email, options) -> { error }
}
```

### Simplified Hooks & Mutators

Only core features are supported:

**Hooks:**
- `useSession()` - Session & user state
- `useListIdentities()` - Linked identities

**Mutators:**
- `updateUser()` - Update user profile or password
- `unlinkIdentity()` - Unlink OAuth provider

### Session Caching

Uses `AuthUIProvider`'s caching system to minimize network requests:
- Built-in cache leverages adapter's session caching (typically 60s TTL)
- Request deduplication for concurrent fetches
- Cross-tab sync (if adapter supports BroadcastChannel)

## Component Categories

### Authentication Components
- **AuthView** - Complete auth flow (sign in/up)
- **SignInForm** - Email/password login
- **SignUpForm** - User registration
- **ForgotPasswordForm** - Password reset request
- **ResetPasswordForm** - Password reset with token
- **MagicLinkForm** - Passwordless via email link
- **ProviderButton** - OAuth provider login

### Account Management Components
- **AccountView** - Complete account management
- **UpdateAvatarCard** - Profile picture upload
- **UpdateNameCard** - Display name editing
- **ChangeEmailCard** - Email change with verification
- **ChangePasswordCard** - Password change
- **AccountsCard** - Linked accounts (OAuth providers)

### Utility Components
- **UserAvatar** - Avatar display with fallback
- **UserButton** - User menu with settings link
- **SignedIn/SignedOut** - Conditional rendering based on auth state

## Data Flow

### Sign In Flow
1. User fills form → SignInForm component
2. Form submits → calls `authClient.signInWithPassword()`
3. API returns session → AuthUIProvider updates context
4. useSession hook fires → components re-render
5. Redirect to dashboard

### Session Persistence
1. Component mounts → useSession hook
2. Calls `authClient.getSession()` → cache check
3. Sets up listener with `onAuthStateChange()`
4. Session changes → hook updates state → re-render
5. Component unmounts → cleanup subscription

## Unsupported Features

The following Better Auth-specific features are intentionally not supported:

- **Organizations**: Better Auth plugin feature
- **API Keys**: Better Auth plugin feature
- **Passkeys**: WebAuthn via Better Auth plugin
- **Multi-Session**: Managing multiple active sessions
- **TOTP**: Time-based two-factor via Better Auth plugin

These would require provider-specific implementations and are out of scope for a Supabase-compatible library.

## Styling

Uses Tailwind CSS with Radix UI primitives:
- CSS imported from `@neondatabase/neon-auth-ui/css`
- Components composed with shadcn/ui patterns
- Easy to customize with Tailwind configuration

## Environment Support

- **Browser**: Full support (localStorage, BroadcastChannel for cross-tab sync)
- **Node.js**: Core auth works, but browser-only features auto-disabled
- **Edge Functions**: Supported via Neon Serverless Driver

## Testing Strategy

Since this is primarily a UI library:
- Component rendering tests (smoke tests)
- Hook behavior tests (useSession, useAuthData)
- Type definitions verification
- Integration tests with neon-auth adapter

## Migration from Better Auth Version

See [MIGRATION.md](./MIGRATION.md) for:
- Breaking changes
- API method mappings
- Component replacements
- Upgrade instructions 