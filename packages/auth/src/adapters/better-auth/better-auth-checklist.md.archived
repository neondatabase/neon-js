# Better Auth Adapter - Method Implementation Checklist

This document tracks the implementation status of each method in the Better Auth adapter.

## Status Legend
- `[ ]` - Not implemented / Needs work
- `[X]` - Implemented
- `[~]` - Partially implemented / Needs review
- `[N/A]` - Not applicable / Intentionally not supported

---

## Initialization & Setup

### `initialize()`
- [ ] Implemented
- [ ] Tested
- **Notes:**
  - Calls `getSession()` to check if session exists
  - Better Auth doesn't require explicit initialization

---

## Session Management

### `getSession()`
- [ ] Implemented
- [ ] Tested
- **Notes:**
  - Uses `betterAuth.getSession()` and maps to Supabase format
  - Always fetches fresh session (no caching)

### `refreshSession()`
- [ ] Implemented
- [ ] Tested
- **Notes:**
  - Delegates to `getSession()` as Better Auth handles auto-refresh
  - Returns user and session data

### `setSession()`
- [ ] Implemented
- [ ] Tested
- **Notes:**
  - Returns "not supported" error
  - Better Auth doesn't support external session setting

---

## User Management

### `getUser()`
- [ ] Implemented
- [ ] Tested
- **Notes:**
  - Extracts user from session via `getSession()`

### `getClaims()`
- [ ] Implemented
- [ ] Tested
- **Notes:**
  - Decodes JWT access token
  - Uses `accessTokenSchema` for validation

### `updateUser()`
- [ ] Implemented
- [ ] Tested
- **Notes:**
  - Maps Supabase attributes to Better Auth format
  - Password updates not supported (requires reauthentication flow)

---

## Authentication Methods

### `signUp()`
- [ ] Implemented
- [ ] Tested
- **Notes:**
  - Supports email/password sign-up
  - Maps metadata from `options.data`
  - Phone sign-up not supported

### `signInWithPassword()`
- [ ] Implemented
- [ ] Tested
- **Notes:**
  - Uses `betterAuth.signIn.email()`
  - Supports email/password
  - Phone sign-in not supported

### `signInWithOAuth()`
- [ ] Implemented
- [ ] Tested
- **Notes:**
  - Uses `betterAuth.signIn.social()`
  - Handles OAuth redirect flow
  - Returns provider and URL

### `signInWithOtp()`
- [ ] Implemented
- [ ] Tested
- **Notes:**
  - Uses `betterAuth.signIn.email()` for magic links
  - Email OTP/magic link supported
  - Phone OTP not supported

### `signInAnonymously()`
- [ ] Implemented
- [ ] Tested
- **Notes:**
  - Returns "not supported" error
  - Better Auth doesn't support anonymous sign-in

### `signInWithIdToken()`
- [ ] Implemented
- [ ] Tested
- **Notes:**
  - Returns "not supported" error
  - Better Auth doesn't support OIDC ID token authentication
  - Use `signInWithOAuth()` instead

### `signInWithSSO()`
- [ ] Implemented
- [ ] Tested
- **Notes:**
  - Returns "not supported" error
  - Better Auth doesn't support enterprise SAML SSO
  - Only OAuth social providers supported

### `signInWithWeb3()`
- [ ] Implemented
- [ ] Tested
- **Notes:**
  - Returns "not supported" error
  - Better Auth doesn't support Web3/crypto wallet authentication

### `signOut()`
- [ ] Implemented
- [ ] Tested
- **Notes:**
  - Uses `betterAuth.signOut()`
  - Emits SIGNED_OUT event

---

## Verification & OTP

### `verifyOtp()`
- [ ] Implemented
- [ ] Tested
- **Notes:**
  - Supports multiple OTP types:
    - `magiclink` / `email` - Uses `verifyEmail()`
    - `signup` / `invite` - Uses `verifyEmail()`
    - `recovery` - Uses `resetPassword()` (verification only)
    - `email_change` - Uses `verifyEmail()`
  - Phone OTP not supported

---

## Password Management

### `resetPasswordForEmail()`
- [ ] Implemented
- [ ] Tested
- **Notes:**
  - Uses `betterAuth.forgetPassword()`
  - Sends password reset email

### `reauthenticate()`
- [ ] Implemented
- [ ] Tested
- **Notes:**
  - Returns "not supported" error
  - Better Auth doesn't support nonce-based reauthentication
  - Use password reset flow instead

### `resend()`
- [ ] Implemented
- [ ] Tested
- **Notes:**
  - Supports `signup` type - Uses `signIn.email()` for magic link
  - `email_change` verification resend not directly supported
  - Phone OTP resend not supported

---

## Identity Management

### `getUserIdentities()`
- [ ] Implemented
- [ ] Tested
- **Notes:**
  - Uses `betterAuth.account.list()`
  - Maps Better Auth accounts to Supabase identities format
  - Requires account plugin to be enabled

### `linkIdentity()`
- [ ] Implemented
- [ ] Tested
- **Notes:**
  - Uses `betterAuth.account.link()`
  - Triggers OAuth redirect flow
  - Requires account plugin to be enabled

### `unlinkIdentity()`
- [ ] Implemented
- [ ] Tested
- **Notes:**
  - Uses `betterAuth.account.unlink()`
  - Emits USER_UPDATED event
  - Requires account plugin to be enabled

---

## State Management

### `onAuthStateChange()`
- [ ] Implemented
- [ ] Tested
- **Notes:**
  - Wraps Better Auth's `useSession` atom
  - Implements cross-tab sync via BroadcastChannel
  - Implements token refresh detection polling
  - Emits events: INITIAL_SESSION, SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED

### `exchangeCodeForSession()`
- [ ] Implemented
- [ ] Tested
- **Notes:**
  - Better Auth handles OAuth callbacks automatically
  - Checks if session exists after callback
  - Emits SIGNED_IN event if session found

### `startAutoRefresh()`
- [ ] Implemented
- [ ] Tested
- **Notes:**
  - No-op (Better Auth handles auto-refresh internally)

### `stopAutoRefresh()`
- [ ] Implemented
- [ ] Tested
- **Notes:**
  - No-op (Better Auth handles auto-refresh internally)

---

## Admin & MFA APIs

### `admin`
- [N/A] Implemented
- [N/A] Tested
- **Notes:**
  - Set to `undefined as never`
  - Not supported by Better Auth adapter

### `mfa`
- [N/A] Implemented
- [N/A] Tested
- **Notes:**
  - Set to `undefined as never`
  - Not supported by Better Auth adapter

---

## Implementation Summary

### Total Methods: 28
- Implemented: 0
- Partially Implemented: 0
- Not Implemented: 0
- Not Applicable: 2 (`admin`, `mfa`)

### Core Features Status
- [ ] Email/Password Authentication
- [ ] OAuth Social Authentication
- [ ] Magic Link / OTP
- [ ] Session Management
- [ ] User Management
- [ ] Identity Linking
- [ ] Password Reset
- [ ] Auth State Changes
- [ ] Cross-tab Synchronization
- [ ] Token Refresh Detection

---

## Testing Status

### Unit Tests
- [ ] Core authentication methods
- [ ] Session management
- [ ] User management
- [ ] Error handling
- [ ] Edge cases

### Integration Tests
- [ ] OAuth flow end-to-end
- [ ] Magic link flow
- [ ] Auth state change events
- [ ] Cross-tab synchronization
- [ ] Token refresh

### Compatibility Tests
- [ ] Supabase compatibility test suite
- [ ] Response format validation
- [ ] Error format validation

---

## Known Limitations

1. **Phone Authentication** - Not supported
2. **Anonymous Sign-In** - Not supported
3. **ID Token Sign-In** - Not supported (use OAuth flow)
4. **SAML SSO** - Not supported
5. **Web3 Authentication** - Not supported
6. **External Session Setting** - Not supported
7. **Nonce-based Reauthentication** - Not supported
8. **Password Updates via updateUser()** - Not supported (use reset flow)

---

## Notes & Observations

### Date Format Handling
- Uses shared `toISOString()` helper
- Handles Date objects, strings, numbers, null, undefined

### Error Handling
- Uses `normalizeBetterAuthError()` for consistent error mapping
- Maps Better Auth errors to Supabase `AuthError`/`AuthApiError` formats

### Session Mapping
- Uses `mapBetterAuthSessionToSupabase()` helper
- Handles JWT token decoding
- Maps user metadata correctly

### Reactive State
- Better Auth uses nanostores atoms (`useSession`)
- Wrapped with callback-based API for Supabase compatibility
- Manual event emission based on session state changes


## Look at metadata passed in to signUp

---

## Next Steps

1. Review each method implementation
2. Add unit tests for each method
3. Add integration tests for key flows
4. Test cross-tab synchronization
5. Verify error handling edge cases
6. Document any deviations from Supabase behavior

## Known todos/Limitations

1. Add https://www.better-auth.com/docs/plugins/email-otp to server
2. BetterAuth does not support linking identities with ID tokens. Use OAuth credentials instead.
3. We need to setup `sendResetPassword` in the server adapter on the emailAndPassword plugin - /Users/pedro.figueiredo/.cursor/worktrees/neon-js/aiut8/node_modules/better-auth/dist/shared/better-auth.BX9UB8EP.mjs

