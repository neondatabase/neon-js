# Neon Auth UI - Migration to Supabase Compatibility (In Progress)

## Current Status

This document tracks the ongoing migration of `@neondatabase/neon-auth-ui` from a Better Auth React client-dependent UI library to a provider-agnostic library that works with any Supabase-compatible auth client.

## Completed Work

### Phase 1: Type System & Dependencies ✅
- **Updated AnyAuthClient type** (`src/types/any-auth-client.ts`):
  - Changed from `ReturnType<typeof createAuthClient>` to `AuthClient` interface
  - Now accepts any Supabase-compatible auth provider

- **Updated type definitions** (`src/types/auth-client.ts`):
  - Removed Better Auth client creation logic
  - Now re-exports types from `@neondatabase/neon-auth`
  - Exports: `AuthClient`, `Session`, `User`

- **Simplified hook types** (`src/types/auth-hooks.ts`):
  - Removed all Better Auth-specific hooks
  - Now only exports: `useSession`, `useListIdentities`
  - Uses Supabase `AuthError`, `Identity`, `Session`, `User` types

- **Simplified mutator types** (`src/types/auth-mutators.ts`):
  - Removed all Better Auth-specific mutators
  - Now only exports: `updateUser`, `unlinkIdentity`

- **Updated package.json**:
  - Removed `better-auth` dependency
  - Kept `@neondatabase/neon-auth` as direct dependency
  - Cleaned up UI dependencies (removed `@better-fetch/fetch`, `@noble/hashes`)

- **Updated neon-auth exports** (`packages/neon-auth/src/index.ts`):
  - Exported `AuthClient` type
  - Re-exported Supabase types: `Session`, `User`, `Identity`

### Phase 2: Custom React Hooks ✅
- **Created useSession hook** (`src/hooks/use-session.ts`):
  - Implements custom React hook using Supabase API
  - Features:
    - Initial session fetch on mount
    - Subscribes to auth state changes via `onAuthStateChange()`
    - Returns: `{ data, isPending, error, refetch }`
    - Manages subscription cleanup on unmount

### Phase 4: Removed Unsupported Features ✅
- **Deleted organization components** (all 24 files in `src/components/organization/`):
  - Organization management (create, update, delete)
  - Member management
  - Invitation handling
  - Organization switcher
  - Organization settings

- **Deleted API Key components** (all files in `src/components/settings/api-key/`):
  - API key listing
  - API key creation and deletion
  - API key display

- **Deleted Passkey components** (all files in `src/components/settings/passkey/`):
  - Passkey/WebAuthn management
  - Passkey creation and deletion

- **Deleted supporting files**:
  - `src/types/organization-options.ts`
  - `src/types/invitation.ts`
  - `src/types/api-key.ts`
  - `src/hooks/use-current-organization.ts`
  - `src/lib/organization-refetcher.tsx`

- **Updated exports** (`src/index.ts`):
  - Removed all organization, API key, and passkey exports
  - Added `use-session` hook export

## Work In Progress

### Phase 3: Update Core Authentication Components
The following components need to be updated to use Supabase API methods instead of Better Auth:

**Sign In/Sign Up Forms** (`src/components/auth/forms/`):
- `sign-in-form.tsx`: Replace `authClient.signIn.email()` with `authClient.signInWithPassword()`
- `sign-up-form.tsx`: Replace `authClient.signUp.email()` with `authClient.signUp()`
- `forgot-password-form.tsx`: Replace with `authClient.resetPasswordForEmail()`
- `reset-password-form.tsx`: Use `authClient.updateUser({ password })`
- `magic-link-form.tsx`: Replace with `authClient.signInWithOtp()`
- `email-otp-form.tsx`: Update to use `authClient.signInWithOtp()`

**OAuth/Provider Integration** (`src/components/auth/`):
- `provider-button.tsx`: Replace `authClient.signIn.social()` with `authClient.signInWithOAuth()`
- `auth-callback.tsx`: Update callback handling for new API

**User Components** (`src/components/`):
- `user-avatar.tsx`: Use `useSession()` hook instead of `authClient.useSession()`
- `user-button.tsx`: Use new hook and `authClient.signOut()`

### Phase 5: Update Account Settings Components
Components that need API updates:

- `src/components/settings/account/accounts-card.tsx`:
  - Replace `useListAccounts()` with `useListIdentities()`
  - Replace `unlinkAccount()` with `unlinkIdentity()`

- `src/components/settings/providers/providers-card.tsx`:
  - Replace `linkIdentity()` calls to use `authClient.linkIdentity()`
  - Update OAuth provider linking flow

- `src/components/settings/security/sessions-card.tsx`:
  - Remove multi-session support (show only current session)
  - Simplify to show only active session info

- `src/components/settings/security/change-email-card.tsx`:
  - Use `authClient.updateUser({ email })`

- `src/components/settings/security/change-password-card.tsx`:
  - Verify current password with `authClient.signInWithPassword()`
  - Update with `authClient.updateUser({ password })`

- `src/components/settings/account/update-avatar-card.tsx`:
  - Use `authClient.updateUser({ data: { image } })`

- `src/components/settings/account/update-name-card.tsx`:
  - Use `authClient.updateUser({ data: { name } })`

### Phase 6: Update Documentation & Examples
- Update README with Supabase-compatible examples
- Create MIGRATION.md guide for upgrading from Better Auth version
- Update CLAUDE.md architecture documentation
- Update README.md with feature list and unsupported features

### Phase 7: Create Example Integration
- Create `examples/basic/` with Next.js example
- Demonstrate integration with `@neondatabase/neon-js`
- Show sign-in, sign-up, account management flows

## Key Architecture Changes

### Before (Better Auth Client)
```typescript
import { createAuthClient } from "better-auth/react"
const authClient = createAuthClient({ plugins: [...] })
<AuthUIProvider authClient={authClient} />
```

### After (Supabase-Compatible)
```typescript
import { createClient } from "@neondatabase/neon-js"
const client = createClient("https://...");
<AuthUIProvider authClient={client.auth} />
```

## Supported Features

✅ Email/Password authentication
✅ OAuth providers (Google, GitHub, etc.)
✅ Password reset/recovery
✅ Email verification
✅ Magic link sign-in (if adapter supports)
✅ Email OTP sign-in (if adapter supports)
✅ User profile management
✅ Account linking/unlinking
✅ Session management
✅ Two-factor auth (basic OTP)

## Not Supported (Better Auth-Specific)

❌ Organizations (all components removed)
❌ API Keys (all components removed)
❌ Passkeys/WebAuthn (all components removed)
❌ Multi-session management
❌ TOTP two-factor auth
❌ Advanced role-based permissions

## Technical Debt / Follow-up Work

1. **auth-ui-provider.tsx refactoring**: This is the largest file (~600+ lines) with deep Better Auth dependencies. It needs comprehensive refactoring to:
   - Remove all organization-related context
   - Remove API key, passkey, multi-session configuration
   - Simplify mutators and hooks to only supported ones
   - Update all internal method calls

2. **Component compatibility**: Some components reference deleted types or props:
   - `user-button.tsx` references `multiSession`
   - `settings` components reference organization/api-key/passkey hooks
   - `account-cell.tsx` references device sessions

3. **Error handling**: Review and update error handling to work with Supabase `AuthError` type

4. **Tanstack integration**: `src/lib/tanstack/` files reference Better Auth APIs and may need updating or removal

5. **Localization**: Review error codes - may need updates for Supabase error types

## Build Status

Current TypeScript errors are expected and tracked in this migration. After completing Phase 3-5, these should be resolved.

## Next Steps

1. Refactor `src/lib/auth-ui-provider.tsx` to remove all Better Auth dependencies
2. Update form components to use Supabase API
3. Update account settings components
4. Fix remaining type errors
5. Create comprehensive documentation
6. Add example application

## Questions or Issues?

This migration adapts the UI library to work with Supabase-compatible auth interfaces, making it usable with `@neondatabase/neon-auth` while maintaining the existing component API where possible.
