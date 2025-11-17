# Remove Better Auth Session Listener Implementation Plan

## Executive Summary

Remove the `setupSessionListener()` method that subscribes to Better Auth's internal nanostore session atom and replace it with **direct synchronous event emission** in all adapter methods. This aligns with Supabase's event model, eliminates race conditions, and decouples us from Better Auth's reactive internals.

## Current State Analysis

### Problems with Current Implementation

**1. Race Conditions:**
- Better Auth's `useSession` atom updates **asynchronously** (10ms debounce in proxy.ts)
- Atom updates occur **after** our adapter methods complete
- This caused the zero-subscribers race condition where apps unsubscribe before events fire
- Example: `signOut()` completes → app unmounts → useSession updates (too late)

**2. Timing Complexity:**
- Two parallel event emission systems:
  - ✅ Synchronous: Direct emission in `signOut()` (already implemented)
  - ❌ Asynchronous: `setupSessionListener()` subscription to Better Auth atom
- Duplicate events possible (synchronous + atom subscription)
- Unpredictable which fires first

**3. Tight Coupling to Better Auth Internals:**
- We depend on Better Auth's nanostore implementation details
- Signal toggle pattern: `signal.set(!signal.get())` with 10ms setTimeout
- If Better Auth changes their state management, we break
- Fighting against their reactive design (meant for UI frameworks like React/Vue)

**4. Architectural Mismatch:**
- Better Auth's atom system is designed for **UI component reactivity** (React hooks)
- We're using it for **programmatic event emission** (pub/sub pattern)
- Better Auth's `$sessionSignal` fires **before** `useSession` updates
- We need delays/timeouts to work around async updates

### What Works (Keep These)

✅ **BroadcastChannel for cross-tab sync** - src/auth/adapters/better-auth/better-auth-adapter.ts:1625-1653
✅ **Token refresh polling** - src/auth/adapters/better-auth/better-auth-adapter.ts:1679-1723
✅ **Session caching** - src/auth/adapters/better-auth/session-cache.ts
✅ **Synchronous signOut emission** (already implemented) - src/auth/adapters/better-auth/better-auth-adapter.ts:798-802

## Desired End State

### Event Emission Model (Matches Supabase)

**Direct synchronous emission in adapter methods:**

| Method | Event Emitted | When |
|--------|---------------|------|
| `signUp()` | `SIGNED_IN` | After successful signup |
| `signInWithPassword()` | `SIGNED_IN` | After successful sign-in |
| `signInWithOAuth()` | None | OAuth redirects (no session yet) |
| `signInWithOtp()` | None | Email sent (no session yet) |
| `verifyOtp()` | `SIGNED_IN` | After successful verification |
| `signOut()` | `SIGNED_OUT` | After clearing cache (already done) |
| `updateUser()` | `USER_UPDATED` | After successful update |
| `linkIdentity()` | None | OAuth redirects (no session yet) |
| `unlinkIdentity()` | `USER_UPDATED` | After successful unlink |
| `exchangeCodeForSession()` | `SIGNED_IN` | After OAuth callback |

**No emission needed:**
- `getSession()` - Read-only
- `refreshSession()` - Handled by token refresh polling
- `getUser()` - Read-only
- `resetPasswordForEmail()` - Email sent (no session change)

### Verification Checklist

After implementation:
- [ ] All auth operations emit events synchronously (no race conditions)
- [ ] Events fire **immediately** after state changes (before method returns)
- [ ] Cross-tab sync still works via BroadcastChannel
- [ ] Token refresh detection still works via polling
- [ ] No dependencies on Better Auth reactive internals
- [ ] Tests pass (especially signOut race condition test)

## What We're NOT Doing

- ❌ **Not** removing BroadcastChannel (cross-tab sync still needed)
- ❌ **Not** removing token refresh polling (still needed for `TOKEN_REFRESHED`)
- ❌ **Not** removing session caching (performance optimization)
- ❌ **Not** adding event emission to read-only methods
- ❌ **Not** emitting for OAuth redirect methods (no session available yet)

## Implementation Approach

### Strategy: Remove Reactive Subscription, Add Direct Emission

**Phase 1: Remove `setupSessionListener()`**
1. Delete the method entirely
2. Remove constructor call to `setupSessionListener()`
3. Remove `useSession.subscribe()` dependency
4. Clean up comments referring to "Better Auth will update useSession atom..."

**Phase 2: Add Direct Event Emission**
1. Add `await this.notifyAllSubscribers()` calls to all state-changing methods
2. Match Supabase's pattern: emit after successful operation
3. Update cache **before** emitting events (ensures consistency)

**Phase 3: Simplify State Management**
1. Keep `lastSessionState` (needed for event type detection)
2. Rely solely on our own state tracking
3. Remove references to Better Auth's reactive system

---

## Phase 1: Remove setupSessionListener()

### Overview
Remove the Better Auth atom subscription system that was causing race conditions and timing issues.

### Changes Required

#### 1. Remove setupSessionListener() method
**File**: `src/auth/adapters/better-auth/better-auth-adapter.ts`

**Lines to delete**: 1488-1563 (entire method)

```typescript
// DELETE THIS ENTIRE METHOD:
private setupSessionListener(): void {
  // Better Auth uses nanostores atoms, listen to useSession atom
  if (this.betterAuth.useSession) {
    // ... entire implementation ...
  }
}
```

#### 2. Remove constructor call
**File**: `src/auth/adapters/better-auth/better-auth-adapter.ts:115`

**Before:**
```typescript
constructor(
  betterAuthClientOptions: BetterAuthClientOptions,
  config?: OnAuthStateChangeConfig
) {
  // ... config setup ...

  this.betterAuth = createAuthClient({
    ...betterAuthClientOptions,
    ...defaultBetterAuthClientOptions,
  });

  // Set up session change listener for Better Auth's reactive system
  this.setupSessionListener();  // ← DELETE THIS LINE
}
```

**After:**
```typescript
constructor(
  betterAuthClientOptions: BetterAuthClientOptions,
  config?: OnAuthStateChangeConfig
) {
  // ... config setup ...

  this.betterAuth = createAuthClient({
    ...betterAuthClientOptions,
    ...defaultBetterAuthClientOptions,
  });

  // Removed setupSessionListener() - we emit events directly in methods
}
```

#### 3. Clean up misleading comments
**File**: `src/auth/adapters/better-auth/better-auth-adapter.ts`

**Search and remove/update these comments:**
- Line 503: `// Better Auth will update the useSession atom, which will trigger setupSessionListener()...`
- Line 592: Same comment in signInWithPassword
- Line 838: Same comment in verifyOtp (multiple occurrences)
- Line 908: Same comment in verifyOtp email_change
- Line 962: Same comment in verifyOtp token_hash
- Line 1022: Same comment in verifyOtp token_hash email_change
- Line 1130: Same comment in updateUser
- Line 1300: Same comment in unlinkIdentity
- Line 1751: Same comment in exchangeCodeForSession

**Replace with:**
```typescript
// Event will be emitted synchronously by this method before return
```

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compilation passes: `bun typecheck`
- [ ] All imports still resolve correctly
- [ ] No references to `setupSessionListener` remain: `git grep setupSessionListener`

#### Manual Verification:
- [ ] Constructor no longer calls `setupSessionListener()`
- [ ] Method deleted from class
- [ ] Comments updated throughout file

---

## Phase 2: Add Direct Event Emission to Auth Methods

### Overview
Add synchronous event emission directly in each method that changes auth state, matching Supabase's pattern.

### Changes Required

#### 1. signUp() - Emit SIGNED_IN
**File**: `src/auth/adapters/better-auth/better-auth-adapter.ts:459-534`

**Add after line 500 (after session is cached):**

```typescript
signUp: AuthClient['signUp'] = async (credentials) => {
  try {
    // Handle email/password sign-up
    if ('email' in credentials && credentials.email && credentials.password) {
      // ... existing implementation ...

      const data = {
        user: sessionResult.data.session.user,
        session: sessionResult.data.session,
      };

      // Emit SIGNED_IN event synchronously (matches Supabase)
      // Session is already cached, safe to emit now
      await this.notifyAllSubscribers('SIGNED_IN', data.session);
      this.lastSessionState = data.session;

      return { data, error: null };
    }
    // ... rest of method ...
  }
};
```

#### 2. signInWithPassword() - Emit SIGNED_IN
**File**: `src/auth/adapters/better-auth/better-auth-adapter.ts:549-623`

**Add after line 589 (after session is cached):**

```typescript
signInWithPassword: AuthClient['signInWithPassword'] = async (
  credentials
) => {
  try {
    // Handle email/password sign-in
    if ('email' in credentials && credentials.email) {
      // ... existing implementation ...

      const data = {
        user: sessionResult.data.session.user,
        session: sessionResult.data.session,
      };

      // Emit SIGNED_IN event synchronously (matches Supabase)
      // Session is already cached, safe to emit now
      await this.notifyAllSubscribers('SIGNED_IN', data.session);
      this.lastSessionState = data.session;

      return { data, error: null };
    }
    // ... rest of method ...
  }
};
```

#### 3. verifyOtp() - Emit SIGNED_IN
**File**: `src/auth/adapters/better-auth/better-auth-adapter.ts:813-1058`

**Multiple locations to add emission (after getSession returns):**

**Location 1 - Magic link verification (line 837):**
```typescript
if (type === 'magiclink' || type === 'email') {
  const sessionResult = await this.getSession();

  if (!sessionResult.data.session) {
    return {
      data: { user: null, session: null },
      error: new AuthError(
        'Failed to retrieve session after OTP verification. Make sure the magic link callback has been processed.',
        500,
        'unexpected_failure'
      ),
    };
  }

  // Emit SIGNED_IN event synchronously
  await this.notifyAllSubscribers('SIGNED_IN', sessionResult.data.session);
  this.lastSessionState = sessionResult.data.session;

  return {
    data: {
      user: sessionResult.data.session.user,
      session: sessionResult.data.session,
    },
    error: null,
  };
}
```

**Location 2 - Token hash magic link (line 960):**
```typescript
if (type === 'magiclink' || type === 'email') {
  const sessionResult = await this.getSession();

  if (!sessionResult.data.session) {
    return {
      data: { user: null, session: null },
      error: new AuthError(
        'Failed to retrieve session after token hash verification',
        500,
        'unexpected_failure'
      ),
    };
  }

  // Emit SIGNED_IN event synchronously
  await this.notifyAllSubscribers('SIGNED_IN', sessionResult.data.session);
  this.lastSessionState = sessionResult.data.session;

  return {
    data: {
      user: sessionResult.data.session.user,
      session: sessionResult.data.session,
    },
    error: null,
  };
}
```

**Location 3 - Email change verification (line 907):**
```typescript
if (type === 'email_change') {
  const result = await this.betterAuth.verifyEmail?.({
    query: { token },
  });

  if (result?.error) {
    return {
      data: { user: null, session: null },
      error: normalizeBetterAuthError(result.error),
    };
  }

  // Get updated session
  const sessionResult = await this.getSession();

  // Emit USER_UPDATED event synchronously (email changed)
  if (sessionResult.data.session) {
    await this.notifyAllSubscribers('USER_UPDATED', sessionResult.data.session);
    this.lastSessionState = sessionResult.data.session;
  }

  return {
    data: {
      user: sessionResult.data.session?.user ?? null,
      session: sessionResult.data.session,
    },
    error: null,
  };
}
```

**Location 4 - Token hash email change (line 1021):**
```typescript
if (type === 'email_change') {
  const result = await this.betterAuth.verifyEmail?.({
    query: { token: token_hash },
  });

  if (result?.error) {
    return {
      data: { user: null, session: null },
      error: normalizeBetterAuthError(result.error),
    };
  }

  const sessionResult = await this.getSession();

  // Emit USER_UPDATED event synchronously (email changed)
  if (sessionResult.data.session) {
    await this.notifyAllSubscribers('USER_UPDATED', sessionResult.data.session);
    this.lastSessionState = sessionResult.data.session;
  }

  return {
    data: {
      user: sessionResult.data.session?.user ?? null,
      session: sessionResult.data.session,
    },
    error: null,
  };
}
```

#### 4. updateUser() - Emit USER_UPDATED
**File**: `src/auth/adapters/better-auth/better-auth-adapter.ts:1060-1143`

**Add after line 1128 (after getSession returns updated session):**

```typescript
updateUser: AuthClient['updateUser'] = async (attributes) => {
  try {
    // ... existing implementation ...

    // Get the updated user
    const updatedSessionResult = await this.getSession();

    if (!updatedSessionResult.data.session) {
      throw new Error('Failed to retrieve updated user');
    }

    // Emit USER_UPDATED event synchronously (matches Supabase)
    await this.notifyAllSubscribers('USER_UPDATED', updatedSessionResult.data.session);
    this.lastSessionState = updatedSessionResult.data.session;

    return {
      data: { user: updatedSessionResult.data.session.user },
      error: null,
    };
  } catch (error) {
    return {
      data: { user: null },
      error: normalizeBetterAuthError(error),
    };
  }
};
```

#### 5. unlinkIdentity() - Emit USER_UPDATED
**File**: `src/auth/adapters/better-auth/better-auth-adapter.ts:1275-1313`

**Add after line 1298 (after successful unlink):**

```typescript
unlinkIdentity: AuthClient['unlinkIdentity'] = async (identity) => {
  try {
    const sessionResult = await this.getSession();

    if (sessionResult.error || !sessionResult.data.session) {
      return {
        data: null,
        error:
          sessionResult.error ||
          new AuthError('No user session found', 401, 'session_not_found'),
      };
    }

    // Direct 1:1 mapping: Supabase unlinkIdentity -> Better Auth account.unlink
    const result = await this.betterAuth.unlinkAccount({
      providerId: identity.provider,
    });

    if (result?.error) {
      return {
        data: null,
        error: normalizeBetterAuthError(result.error),
      };
    }

    // Emit USER_UPDATED event synchronously (identity unlinked)
    // Get fresh session to reflect unlinked identity
    const updatedSession = await this.getSession();
    if (updatedSession.data.session) {
      await this.notifyAllSubscribers('USER_UPDATED', updatedSession.data.session);
      this.lastSessionState = updatedSession.data.session;
    }

    return {
      data: {},
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: normalizeBetterAuthError(error),
    };
  }
};
```

#### 6. exchangeCodeForSession() - Emit SIGNED_IN
**File**: `src/auth/adapters/better-auth/better-auth-adapter.ts:1742-1777`

**Add after line 1750 (after session is retrieved):**

```typescript
exchangeCodeForSession: AuthClient['exchangeCodeForSession'] = async (
  _authCode: string
) => {
  try {
    // Better Auth handles OAuth callbacks automatically
    // Just check if we have a session now
    const sessionResult = await this.getSession();

    if (sessionResult.data.session) {
      // Emit SIGNED_IN event synchronously (OAuth callback completed)
      await this.notifyAllSubscribers('SIGNED_IN', sessionResult.data.session);
      this.lastSessionState = sessionResult.data.session;

      return {
        data: {
          session: sessionResult.data.session,
          user: sessionResult.data.session.user,
        },
        error: null,
      };
    }

    return {
      data: { session: null, user: null },
      error: new AuthError(
        'OAuth callback completed but no session was created. Make sure the OAuth callback has been processed.',
        500,
        'oauth_callback_failed'
      ),
    };
  } catch (error) {
    return {
      data: { session: null, user: null },
      error: normalizeBetterAuthError(error),
    };
  }
};
```

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compilation passes: `bun typecheck`
- [ ] All tests pass: `bun test:node`
- [ ] SignOut race condition test passes (verifies synchronous emission)

#### Manual Verification:
- [ ] Events fire immediately after state changes (no delays)
- [ ] `lastSessionState` is updated after each emission
- [ ] Session cache is updated **before** event emission
- [ ] All methods that change state emit appropriate events

---

## Phase 3: Update Documentation

### Overview
Update comments and documentation to reflect the new synchronous emission model.

### Changes Required

#### 1. Update class-level documentation
**File**: `src/auth/adapters/better-auth/better-auth-adapter.ts:27-58`

**Update the Session Management section:**

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
 * - linkIdentity → betterAuth.linkSocial()
 * - unlinkIdentity → betterAuth.account.unlink()
 *
 * Password Management:
 * - resetPasswordForEmail → betterAuth.forgetPassword()
 *
 * Session Caching:
 * - SessionCache provides 60-second TTL for getSession() results
 * - Reduces network calls during normal operation
 * - Invalidation flag prevents stale data during sign-out
 *
 * Event Emission (Supabase-compatible):
 * - Events are emitted synchronously in auth methods (no reactive subscriptions)
 * - SIGNED_IN: After successful sign-up, sign-in, OTP verification, OAuth callback
 * - SIGNED_OUT: After sign-out completes
 * - USER_UPDATED: After updateUser, unlinkIdentity, email change verification
 * - TOKEN_REFRESHED: Detected via polling (30-second interval)
 * - Cross-tab sync via BroadcastChannel (browser only)
 *
 * Based on: https://www.better-auth.com/docs/guides/supabase-migration-guide
 */
```

#### 2. Update lastSessionState comment
**File**: `src/auth/adapters/better-auth/better-auth-adapter.ts:77-91`

**Update the comment to remove atom references:**

```typescript
/**
 * Last known session state for detecting auth change event types
 *
 * Required for Supabase AuthChangeEvent compatibility:
 * - We track the previous session to determine which event to emit
 * - Updated synchronously after each auth state change
 * - Used by notifyAllSubscribers to determine event type if needed
 *
 * Event type determination:
 * - null → session = SIGNED_IN (new session created)
 * - session → null = SIGNED_OUT (session destroyed)
 * - session → different session (user ID changed) = SIGNED_IN (switched accounts)
 * - session → same session (user data changed) = USER_UPDATED (profile update)
 *
 * Cannot be eliminated without breaking Supabase compatibility.
 */
private lastSessionState: Session | null = null;
```

#### 3. Update CLAUDE.md
**File**: `CLAUDE.md`

**Update the Better Auth Adapter section to reflect new event model:**

Find section "### Implementation Details:" (around line 120) and update:

```markdown
### Implementation Details:

The adapter implements sophisticated state management:
- **Event emission**: Synchronous emission in all state-changing methods (matches Supabase pattern)
- **Cross-tab synchronization**: BroadcastChannel for auth state sync across tabs (browser only)
- **Token refresh detection**: Automatic polling (30s interval) to detect token refreshes
- **Event system**: `onAuthStateChange()` for monitoring `SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`, `USER_UPDATED` events
- **Session mapping**: Transforms Better Auth sessions to Supabase-compatible format
- **Cache invalidation**: Prevents race conditions during sign-out with invalidation flags

See `REMOVE_BETTER_AUTH_SESSION_LISTENER.md` for detailed implementation notes on the synchronous event model.
```

#### 4. Update BETTER_AUTH_SIMPLIFICATION.md (if it exists)
**File**: `BETTER_AUTH_SIMPLIFICATION.md`

**Add a section documenting the event model change:**

```markdown
## Event Emission Model

### Decision: Direct Synchronous Emission (No Reactive Subscriptions)

**Date**: 2025-01-08

**Problem**:
- Better Auth's `useSession` atom updates asynchronously (10ms debounce)
- Caused race conditions where apps unsubscribed before events fired
- Tight coupling to Better Auth's internal reactive system (nanostores)

**Solution**:
Remove `setupSessionListener()` that subscribed to Better Auth's atom. Instead, emit events synchronously in each method:

- `signUp()` → emit `SIGNED_IN`
- `signInWithPassword()` → emit `SIGNED_IN`
- `verifyOtp()` → emit `SIGNED_IN` or `USER_UPDATED`
- `signOut()` → emit `SIGNED_OUT` (already implemented)
- `updateUser()` → emit `USER_UPDATED`
- `unlinkIdentity()` → emit `USER_UPDATED`
- `exchangeCodeForSession()` → emit `SIGNED_IN`

**Benefits**:
- ✅ Predictable: Events fire exactly when we decide
- ✅ Synchronous: No race conditions
- ✅ Simple: Single source of truth
- ✅ Decoupled: Independent of Better Auth internals
- ✅ Maintainable: Matches Supabase's event model

**Trade-offs**:
- Won't detect external sign-outs from Better Auth's UI components
- Won't detect state changes from direct Better Auth API calls

These trade-offs are acceptable because:
- Most apps use a single auth client instance through our adapter
- Cross-tab sync via BroadcastChannel covers multi-tab scenarios
- Token refresh detection via polling catches token updates
```

### Success Criteria

#### Automated Verification:
- [ ] Documentation is comprehensive and accurate
- [ ] No references to `setupSessionListener` in comments
- [ ] CLAUDE.md reflects new architecture

#### Manual Verification:
- [ ] Class-level JSDoc updated
- [ ] State management comments accurate
- [ ] Project documentation consistent

---

## Testing Strategy

### Unit Tests

**Existing tests should pass without modification:**
- `src/auth/__tests__/auth-flows.test.ts` - Sign-up and sign-in flows
- `src/auth/__tests__/session-management.test.ts` - Session lifecycle
- `src/auth/__tests__/user-management.test.ts` - User updates

**Key test to verify synchronous emission:**
```typescript
// src/auth/__tests__/session-management.test.ts
describe('Auth state change events', () => {
  it('emits SIGNED_OUT synchronously before app unmounts', async () => {
    const events: Array<{ event: AuthChangeEvent; session: Session | null }> = [];

    // Subscribe to events
    const { data: subscription } = adapter.onAuthStateChange((event, session) => {
      events.push({ event, session });
    });

    // Sign in first
    await adapter.signInWithPassword({
      email: 'test@example.com',
      password: 'password123',
    });

    // Clear events from sign-in
    events.length = 0;

    // Sign out
    await adapter.signOut();

    // Immediately unsubscribe (simulating app unmount)
    subscription.subscription.unsubscribe();

    // Verify SIGNED_OUT was emitted BEFORE unsubscribe
    expect(events).toContainEqual({ event: 'SIGNED_OUT', session: null });
  });
});
```

### Integration Tests

**Test cross-tab synchronization:**
```typescript
it('broadcasts sign-out to other tabs via BroadcastChannel', async () => {
  // Create two adapter instances (simulating two tabs)
  const tab1 = new BetterAuthAdapter({ baseURL: 'http://localhost:3000' });
  const tab2 = new BetterAuthAdapter({ baseURL: 'http://localhost:3000' });

  const tab2Events: AuthChangeEvent[] = [];
  tab2.onAuthStateChange((event) => {
    tab2Events.push(event);
  });

  // Sign in on tab1
  await tab1.signInWithPassword({
    email: 'test@example.com',
    password: 'password123',
  });

  // Sign out on tab1
  await tab1.signOut();

  // Wait for BroadcastChannel message
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Verify tab2 received SIGNED_OUT event
  expect(tab2Events).toContain('SIGNED_OUT');
});
```

### Manual Testing Steps

1. **Sign-in flow**:
   - Open browser dev console
   - Call `client.auth.signInWithPassword({ email, password })`
   - Verify event fires immediately (check logs)
   - Verify session is available

2. **Sign-out flow**:
   - Subscribe to `onAuthStateChange`
   - Call `client.auth.signOut()`
   - Verify `SIGNED_OUT` event fires
   - Immediately unsubscribe
   - Verify no errors or warnings

3. **User update flow**:
   - Call `client.auth.updateUser({ data: { displayName: 'New Name' } })`
   - Verify `USER_UPDATED` event fires
   - Verify updated data in session

4. **Cross-tab sync**:
   - Open app in two browser tabs
   - Sign out in tab 1
   - Verify tab 2 receives `SIGNED_OUT` event

## Performance Considerations

### Impact Assessment

**Positive:**
- ✅ No more atom subscription overhead
- ✅ Synchronous events are faster (no 10ms debounce)
- ✅ Simpler call stack (easier debugging)
- ✅ Fewer event listeners in memory

**Neutral:**
- Session cache still provides fast reads
- Token refresh polling unchanged
- BroadcastChannel overhead unchanged

**None:**
- No negative performance impact expected

## Migration Notes

### For Existing Users

**No breaking changes** - The public API remains identical:
- `onAuthStateChange()` signature unchanged
- Event types unchanged (`SIGNED_IN`, `SIGNED_OUT`, etc.)
- Subscription object unchanged

**Behavioral changes** (improvements):
- Events now fire synchronously (more predictable)
- No more race conditions during sign-out
- Events fire before method returns (consistent timing)

### For Developers

**If you were relying on Better Auth's atom updates:**
- The adapter no longer subscribes to `useSession` atom
- Use the adapter's `onAuthStateChange()` instead
- If you need Better Auth's reactive hooks, use them directly alongside the adapter

## References

### Implementation Files
- Better Auth adapter: `src/auth/adapters/better-auth/better-auth-adapter.ts`
- Session cache: `src/auth/adapters/better-auth/session-cache.ts`

### Better Auth Internals (for reference only)
- Session atom: `/Users/pedro.figueiredo/Documents/git/neon/better-auth/packages/better-auth/src/client/session-atom.ts`
- Query pattern: `/Users/pedro.figueiredo/Documents/git/neon/better-auth/packages/better-auth/src/client/query.ts`
- Proxy interceptor: `/Users/pedro.figueiredo/Documents/git/neon/better-auth/packages/better-auth/src/client/proxy.ts`

### External References
- Supabase GoTrueClient: https://github.com/supabase/auth-js/blob/master/src/GoTrueClient.ts
- Supabase event emission pattern: Direct synchronous emission in methods
- Better Auth migration guide: https://www.better-auth.com/docs/guides/supabase-migration-guide

---

## Appendix: Better Auth's Reactive Architecture (For Understanding)

### How Better Auth's Atom System Works

Better Auth uses a **signal-driven reactive architecture**:

1. **Atoms** (nanostore): Store immutable state with subscribers
2. **Signals** (boolean atoms): Trigger cascading updates when toggled
3. **Listeners** (route matchers): Associate auth routes with signal atoms
4. **Proxy** (dynamic path interceptor): Toggles signals after auth operations
5. **Query** (fetch orchestrator): Watches signals and executes fetches
6. **Framework adapters** (React/Vue/Svelte): Convert atoms to framework hooks

**Key insight**: Auth operations don't update the session atom directly. Instead:
1. Method completes (e.g., `signIn.email()`)
2. Proxy intercepts success callback
3. Signal toggles after 10ms debounce
4. Query atom detects signal toggle
5. Query refetches `/get-session`
6. Atom updates with fresh session
7. React hook re-renders component

**This is designed for UI components**, not programmatic event emission.

### Why We're Not Using It

**Problem**: Asynchronous updates cause race conditions
- Atom updates **after** our methods complete
- Apps may unsubscribe before atom updates
- Timing is unpredictable (10ms + network latency)

**Solution**: Emit events directly in our methods
- Synchronous emission before method returns
- Predictable timing (immediate)
- No dependency on Better Auth internals
- Matches Supabase's pattern
