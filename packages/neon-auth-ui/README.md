# @neondatabase/neon-auth-ui

React UI component library for authentication, built on the Supabase-compatible `AuthClient` interface. Works with any auth provider that implements Supabase's auth API, including `@neondatabase/neon-auth`.

## Installation

```bash
npm install @neondatabase/neon-auth-ui
# or
bun add @neondatabase/neon-auth-ui
```

## Quick Start

```typescript
import { createClient } from '@neondatabase/neon-js';
import { AuthUIProvider, AuthView } from '@neondatabase/neon-auth-ui';
import '@neondatabase/neon-auth-ui/css';

const client = createClient('https://ep-xxx.neon.build/neondb');

function App() {
  return (
    <AuthUIProvider authClient={client.auth}>
      <AuthView />
    </AuthUIProvider>
  );
}
```

## Features

### Supported
- ✅ Email/Password authentication
- ✅ OAuth providers (Google, GitHub, etc.)
- ✅ Password reset/recovery
- ✅ Email verification
- ✅ Magic link sign-in (if supported by adapter)
- ✅ Email OTP sign-in (if supported by adapter)
- ✅ User profile management
- ✅ Account linking/unlinking
- ✅ Session management
- ✅ Customizable UI components

### Not Supported
- ❌ Organizations
- ❌ API Keys
- ❌ Passkeys (WebAuthn)
- ❌ Multi-session management
- ❌ TOTP two-factor auth

These features are specific to Better Auth and not part of the Supabase-compatible interface.

## Components

### Authentication
- `<AuthView />` - Complete authentication UI
- `<SignInForm />` - Sign-in form
- `<SignUpForm />` - Sign-up form
- `<ForgotPasswordForm />` - Password reset request
- `<ResetPasswordForm />` - Password reset form
- `<MagicLinkForm />` - Magic link sign-in

### Account Management
- `<AccountView />` - Complete account management UI
- `<UpdateAvatarCard />` - Avatar upload
- `<UpdateNameCard />` - Name update
- `<ChangeEmailCard />` - Email change
- `<ChangePasswordCard />` - Password change
- `<AccountsCard />` - Linked accounts management

### Utility
- `<SignedIn>` - Render when authenticated
- `<SignedOut>` - Render when not authenticated
- `<UserAvatar />` - User avatar display
- `<UserButton />` - User menu dropdown

## Hooks

### useSession
```typescript
const { data, isPending, error, refetch } = useSession(authClient);

// Access session data
const session = data?.session;
const user = data?.user;
```

### useAuthData
Generic hook for fetching auth-related data with caching:
```typescript
const { data, isPending, error, refetch } = useAuthData({
  queryFn: () => authClient.getUserIdentities(),
  cacheKey: 'identities',
  staleTime: 60000, // 1 minute
});
```

## Development

```bash
# Build the package
bun run build

# Watch mode
bun run dev

# Run tests
bun test

# Type check
bun typecheck
```

## Migration Guide

If you're upgrading from an earlier version using Better Auth React client, see [MIGRATION.md](./MIGRATION.md) for breaking changes and upgrade instructions.

## Architecture

This package provides React components and hooks built on top of the Supabase-compatible `AuthClient` interface. It has no direct dependency on Better Auth - all auth functionality is delegated to the provided auth client.

For implementation details, see [CLAUDE.md](./CLAUDE.md).

## License

Apache-2.0
