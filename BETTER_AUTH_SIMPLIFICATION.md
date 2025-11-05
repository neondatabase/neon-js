# Better Auth Adapter Simplification

## Overview

The Better Auth adapter has been simplified using 1:1 mappings from the [Better Auth Supabase Migration Guide](https://www.better-auth.com/docs/guides/supabase-migration-guide#update-your-code).

## Changes Made

### 1. Authentication Methods

#### Sign Up
**Before:**
```typescript
const metadata = credentials.options?.data || {};
const result = await this.betterAuth.signUp.email({
  email: credentials.email,
  password: credentials.password,
  name: '',
  //TODO: look at this metadata
  ...metadata,
});
```

**After:**
```typescript
// Direct 1:1 mapping: Supabase signUp -> Better Auth signUp.email
const result = await this.betterAuth.signUp.email({
  email: credentials.email,
  password: credentials.password,
  name: credentials.options?.data?.displayName || '',
});
```

#### Sign In with Password
**Before:**
```typescript
const result = (await (this.betterAuth.signIn as any)?.email?.({
  email: credentials.email,
  password: credentials.password,
})) || { error: new Error('signIn.email is not available') };
```

**After:**
```typescript
// Direct 1:1 mapping: Supabase signInWithPassword -> Better Auth signIn.email
const result = await this.betterAuth.signIn.email({
  email: credentials.email,
  password: credentials.password,
});
```

#### Sign In with OAuth
**Before:**
```typescript
const callbackURL =
  options?.redirectTo ||
  (typeof window !== 'undefined' ? window.location.origin : '');

await (this.betterAuth.signIn as any)?.social?.({
  provider,
  callbackURL,
});
```

**After:**
```typescript
// Direct 1:1 mapping: Supabase signInWithOAuth -> Better Auth signIn.social
await this.betterAuth.signIn.social({
  provider,
  callbackURL: options?.redirectTo || (typeof window !== 'undefined' ? window.location.origin : ''),
});
```

#### Sign In with OTP (Magic Link)
**Before:**
```typescript
const callbackURL =
  credentials.options?.emailRedirectTo ||
  (typeof window !== 'undefined' ? window.location.origin : '');

const result = (await (this.betterAuth.signIn as any)?.email?.({
  email: credentials.email,
  callbackURL,
})) || { error: new Error('signIn.email is not available') };
```

**After:**
```typescript
// Direct 1:1 mapping: Supabase signInWithOtp -> Better Auth magic link (via signIn.email)
const result = await (this.betterAuth.signIn as any)?.email?.({
  email: credentials.email,
  callbackURL: credentials.options?.emailRedirectTo || 
    (typeof window !== 'undefined' ? window.location.origin : ''),
});
```

### 2. User Management Methods

#### Update User
**Before:**
```typescript
// Map Supabase attributes to Better Auth update format
const updateData: Record<string, unknown> = {};

if (attributes.data) {
  const data = attributes.data;
  if (data && 'displayName' in data && typeof data.displayName === 'string') {
    updateData.name = data.displayName;
  }
  if (data && 'profileImageUrl' in data && typeof data.profileImageUrl === 'string') {
    updateData.image = data.profileImageUrl;
  }
  // Store other metadata
  Object.keys(data).forEach((key) => {
    if (key !== 'displayName' && key !== 'profileImageUrl') {
      updateData[key] = (data as Record<string, unknown>)[key];
    }
  });
}

const result = (await (this.betterAuth as any).user?.update?.(
  updateData
)) || { error: new Error('user.update is not available') };
```

**After:**
```typescript
// Direct 1:1 mapping: Supabase updateUser -> Better Auth user.update
const updateData: Record<string, unknown> = {};

if (attributes.data) {
  const data = attributes.data;
  if (data && 'displayName' in data && typeof data.displayName === 'string') {
    updateData.name = data.displayName;
  }
  if (data && 'profileImageUrl' in data && typeof data.profileImageUrl === 'string') {
    updateData.image = data.profileImageUrl;
  }
}

if (attributes.email) {
  updateData.email = attributes.email;
}

const result = await (this.betterAuth as any).user?.update?.(updateData);
```

#### Get User Identities
**Before:**
```typescript
const result = (await (this.betterAuth as any).account?.list?.()) || {
  data: { accounts: [] },
  error: null,
};
```

**After:**
```typescript
// Direct 1:1 mapping: Supabase getUserIdentities -> Better Auth account.list
const result = await (this.betterAuth as any).account?.list?.();
```

#### Link Identity
**Before:**
```typescript
const callbackURL =
  credentials.options?.redirectTo ||
  (typeof window !== 'undefined' ? window.location.origin : '');

// Convert scopes from Supabase format (space-separated string) to Better Auth format (array)
const scopes = credentials.options?.scopes
  ? credentials.options.scopes.split(' ')
  : undefined;

await (this.betterAuth as any).account?.link?.({
  provider: credentials.provider,
  callbackURL,
  scopes,
});
```

**After:**
```typescript
// Direct 1:1 mapping: Supabase linkIdentity -> Better Auth account.link
const callbackURL = credentials.options?.redirectTo || 
  (typeof window !== 'undefined' ? window.location.origin : '');

await (this.betterAuth as any).account?.link?.({
  provider: credentials.provider,
  callbackURL,
  scopes: credentials.options?.scopes?.split(' '),
});
```

#### Unlink Identity
**Before:**
```typescript
const result = (await (this.betterAuth as any).account?.unlink?.({
  accountId: identity.identity_id,
})) || { error: new Error('account.unlink is not available') };
```

**After:**
```typescript
// Direct 1:1 mapping: Supabase unlinkIdentity -> Better Auth account.unlink
const result = await (this.betterAuth as any).account?.unlink?.({
  accountId: identity.identity_id,
});
```

### 3. Password Management

#### Reset Password for Email
**Before:**
```typescript
const callbackURL =
  options?.redirectTo ||
  (typeof window !== 'undefined' ? window.location.origin : '');

const result = (await (this.betterAuth as any).forgetPassword?.({
  email,
  redirectTo: callbackURL,
})) || { error: new Error('forgetPassword is not available') };
```

**After:**
```typescript
// Direct 1:1 mapping: Supabase resetPasswordForEmail -> Better Auth forgetPassword
const result = await (this.betterAuth as any).forgetPassword?.({
  email,
  redirectTo: options?.redirectTo || 
    (typeof window !== 'undefined' ? window.location.origin : ''),
});
```

### 4. Other Improvements

#### Resend Verification
**Before:**
```typescript
const callbackURL =
  options?.emailRedirectTo ||
  (typeof window !== 'undefined' ? window.location.origin : '');

const result = (await (this.betterAuth.signIn as any)?.email?.({
  email,
  callbackURL,
})) || { error: new Error('signIn.email is not available') };
```

**After:**
```typescript
// Direct mapping: resend verification → Better Auth signIn.email (magic link)
const result = await (this.betterAuth.signIn as any)?.email?.({
  email,
  callbackURL: options?.emailRedirectTo || 
    (typeof window !== 'undefined' ? window.location.origin : ''),
});
```

## Additional Simplifications

### Removed `_fetchFreshSession` Private Method

**Before:**
The code had a private method `_fetchFreshSession()` that was called from:
- `getSession()`
- `signUp()` 
- `signInWithPassword()`

This added an unnecessary layer of indirection.

**After:**
The session fetching logic is now directly in `getSession()`, and other methods simply call `this.getSession()`:

```typescript
// In signUp and signInWithPassword
const sessionResult = await this.getSession(); // Instead of this._fetchFreshSession()
```

This simplification:
- ✅ Removes unnecessary private method
- ✅ Makes the code flow more obvious
- ✅ Follows the DRY principle (Don't Repeat Yourself)
- ✅ Uses the public API consistently

## Key Benefits

1. **Cleaner Code**: Removed unnecessary fallback objects, verbose conditionals, and private helper methods
2. **Better Documentation**: Added inline comments showing the 1:1 mapping
3. **Consistent Patterns**: All methods follow the same direct mapping approach
4. **Easier Maintenance**: Less complex code means easier debugging and updates
5. **Type Safety**: Removed unnecessary type assertions where possible
6. **Reduced Indirection**: Eliminated unnecessary private methods by using public APIs

## Complete Mapping Reference

The adapter now has a clear header documenting all 1:1 mappings:

```typescript
/**
 * Better Auth adapter implementing the AuthClient interface
 * 
 * This adapter provides direct 1:1 mappings from Supabase Auth to Better Auth:
 * 
 * Authentication:
 * - signUp → betterAuth.signUp.email()
 * - signInWithPassword → betterAuth.signIn.email()
 * - signInWithOAuth → betterAuth.signIn.social()
 * - signInWithOtp → betterAuth.signIn.email() (magic link)
 * - signOut → betterAuth.signOut()
 * 
 * Session Management:
 * - getSession → betterAuth.getSession()
 * - getUser → betterAuth.getSession() (extract user)
 * 
 * User Management:
 * - updateUser → betterAuth.user.update()
 * - getUserIdentities → betterAuth.account.list()
 * - linkIdentity → betterAuth.account.link()
 * - unlinkIdentity → betterAuth.account.unlink()
 * 
 * Password Management:
 * - resetPasswordForEmail → betterAuth.forgetPassword()
 * 
 * Based on: https://www.better-auth.com/docs/guides/supabase-migration-guide
 */
```

## Methods Kept As-Is (Complex Logic)

The following methods were **not** simplified as they don't have simple 1:1 mappings and contain complex logic:

1. **verifyOtp** - Complex token verification logic with multiple types
2. **onAuthStateChange** - Complex event subscription and cross-tab synchronization
3. **setupSessionListener** - Better Auth reactive session monitoring
4. **Token refresh detection** - Polling and automatic refresh handling
5. **Session mapping** - Complex transformation between Better Auth and Supabase formats

These methods remain unchanged because they require:
- Custom state management
- Event emitters and subscriptions
- Data transformation between formats
- Browser API integration (BroadcastChannel)
- Polling mechanisms

## Reference

Based on the official Better Auth Supabase Migration Guide:
https://www.better-auth.com/docs/guides/supabase-migration-guide#update-your-code

