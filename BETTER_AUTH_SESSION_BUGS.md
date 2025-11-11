# Better Auth Adapter: Session Management Bugs

**Document Date**: 2025-01-11
**File**: `src/auth/adapters/better-auth/better-auth-adapter.ts`
**Affected Methods**: `getSession()`, `refreshSession()`, `getJwtToken()`

---

## Overview

This document catalogs the bugs and performance issues in the current Better Auth adapter session management implementation. Each bug is analyzed with severity, impact, frequency, and proposed solutions.

---

## Bug #1: Thundering Herd on Cache Miss

**Severity**: 🔴 High
**Type**: Performance Issue
**Location**: `getSession()` lines 156-233

### Description

When multiple concurrent calls to `getSession()` occur with an empty cache, all calls trigger independent network requests to Better Auth. There is no deduplication mechanism for in-flight requests.

### Code Location

```typescript
// lines 156-233
getSession: AuthClient['getSession'] = async () => {
  try {
    // Step 1: Fast Path - Read from synchronous cache
    const cachedSession = this.sessionStorage.get();
    if (cachedSession) {
      if (this.sessionStorage.isInvalidated()) {
        return { data: { session: null }, error: null };
      }
      return { data: { session: cachedSession }, error: null }; // ✅ Fast path
    }

    // ❌ NO DEDUPLICATION HERE - concurrent calls all execute this
    const response = await this.betterAuth.getSession({...});
    // ... fetch logic
  }
};
```

### Reproduction Scenario

```typescript
// Component mounts with 10 child components that all call useSession()
const App = () => {
  return (
    <>
      <UserProfile />  {/* calls getSession() */}
      <Dashboard />    {/* calls getSession() */}
      <Sidebar />      {/* calls getSession() */}
      {/* ... 7 more components */}
    </>
  );
};
```

### Timeline

```
t0:   Calls 1-10 all check cache → miss
t1:   Call 1 starts betterAuth.getSession()
t2:   Call 2 starts betterAuth.getSession() (cache still empty!)
t3:   Call 3 starts betterAuth.getSession() (cache still empty!)
...
t10:  Call 10 starts betterAuth.getSession()
t200ms: Call 1 completes, writes cache
t205ms: Call 2 completes, overwrites cache
t210ms: Call 3 completes, overwrites cache
...
t250ms: Call 10 completes, overwrites cache (final write)
```

### Impact

- ❌ 10 identical network requests to Better Auth server
- ❌ 10 identical session mapping operations (`mapBetterAuthSessionToSupabase`)
- ❌ 10 identical JWT fetches (line 220: `await this.getJwtToken()`)
- ❌ 10 cache writes (potential race conditions on final state)
- ❌ Increased server load and bandwidth usage
- ❌ Slower initial page load time (~2000ms total instead of ~200ms)

### Frequency

- **Every page load** when cache is empty (cold start)
- **Every session refresh** if multiple components request simultaneously
- **Common in React applications** with multiple `useSession()` hooks

### Real-World Impact

**Mitigating factors**:
- Cache hits after first request completes (~200ms)
- Modern browsers can pipeline HTTP requests

**Actual impact**:
- Moderate to High: Better Auth server does **not** deduplicate cookie-based requests - each call is processed independently
- Impact increases on slow networks or high-latency connections
- Server load increases proportionally with concurrent requests

### Proposed Solution

Add promise caching to deduplicate concurrent requests:

```typescript
export class BetterAuthAdapter implements AuthClient {
  private getSessionPromise: Promise<AuthResponse<Session>> | null = null;

  getSession: AuthClient['getSession'] = async () => {
    try {
      // Fast path: cache check
      const cachedSession = this.sessionStorage.get();
      if (cachedSession && !this.sessionStorage.isInvalidated()) {
        return { data: { session: cachedSession }, error: null };
      }

      // Deduplication: reuse in-flight promise
      if (this.getSessionPromise) {
        return await this.getSessionPromise;
      }

      // Create new promise
      this.getSessionPromise = this._fetchSession();

      try {
        return await this.getSessionPromise;
      } finally {
        this.getSessionPromise = null;
      }
    } catch (error) {
      return {
        data: { session: null },
        error: normalizeBetterAuthError(error),
      };
    }
  };

  private async _fetchSession(): Promise<AuthResponse<Session>> {
    // Move existing fetch logic here (lines 171-226)
    // ...
  }
}
```

**Complexity**: ~15 lines of code
**Benefit**: 90% reduction in network requests on cache miss

---

## Bug #2: `refreshSession()` Doesn't Actually Refresh

**Severity**: 🔴 Critical
**Type**: Correctness Bug
**Location**: `refreshSession()` lines 235-261

### Description

The `refreshSession()` method currently just calls `getSession()`, which immediately returns cached data if the cache is still valid. This violates the API contract where `refreshSession()` should **always** fetch fresh tokens from the server, bypassing the cache.

### Code Location

```typescript
// lines 235-261
refreshSession: AuthClient['refreshSession'] = async () => {
  try {
    // ❌ This just calls getSession() - hits cache immediately!
    const sessionResult = await this.getSession();

    if (sessionResult.error) {
      return {
        data: { user: null, session: null },
        error: sessionResult.error,
      };
    }

    return {
      data: {
        user: sessionResult.data.session?.user ?? null,
        session: sessionResult.data.session,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: { user: null, session: null },
      error: normalizeBetterAuthError(error),
    };
  }
};
```

### Reproduction Scenario

```typescript
// User explicitly requests token refresh
const { data: session1 } = await client.auth.getSession();
console.log('Session 1:', session1.access_token); // Token: abc123

// Wait 5 seconds (cache still valid, TTL = 60s)
await new Promise(r => setTimeout(r, 5000));

// User explicitly refreshes
const { data: session2 } = await client.auth.refreshSession();
console.log('Session 2:', session2.access_token); // ❌ Still: abc123 (cached!)

// Expected: Fresh token from server
// Actual: Same cached token
```

### Impact

- ❌ Violates API contract: `refreshSession()` should force refresh
- ❌ User expectations broken: calling refresh does nothing
- ❌ Stale tokens returned when fresh tokens expected
- ❌ Incompatible with Supabase behavior (breaks migration compatibility)
- ❌ Security concern: Cannot force token rotation on demand

### Frequency

- **Every explicit call** to `refreshSession()`
- **Whenever cache is valid** (TTL hasn't expired)

### Real-World Impact

**High severity because**:
- Users explicitly call this method expecting fresh data
- Common use case: Force refresh before sensitive operation
- Example: "Refresh my session before making payment"
- Breaks compatibility with Supabase's `refreshSession()` behavior

### Supabase Comparison

```typescript
// Supabase's refreshSession ALWAYS refreshes
async refreshSession() {
  return this._acquireLock(async () => {
    // Force refresh even if cache valid
    return await this._refreshAccessToken(this.currentSession.refresh_token);
  });
}
```

### Proposed Solution

Force cache bypass before fetching:

```typescript
refreshSession: AuthClient['refreshSession'] = async () => {
  try {
    // FIX: Clear cache to force fresh fetch
    this.sessionStorage.clear();

    // Now getSession() will skip cache and fetch fresh
    const sessionResult = await this.getSession();

    if (sessionResult.error) {
      return {
        data: { user: null, session: null },
        error: sessionResult.error,
      };
    }

    return {
      data: {
        user: sessionResult.data.session?.user ?? null,
        session: sessionResult.data.session,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: { user: null, session: null },
      error: normalizeBetterAuthError(error),
    };
  }
};
```

**Alternative**: Separate refresh logic entirely:

```typescript
refreshSession: AuthClient['refreshSession'] = async () => {
  try {
    // Deduplicate refresh requests
    if (this.refreshSessionPromise) {
      return await this.refreshSessionPromise;
    }

    // Clear cache immediately
    this.sessionStorage.clear();

    this.refreshSessionPromise = this._fetchSession();

    try {
      const sessionResult = await this.refreshSessionPromise;
      // ... rest of logic
    } finally {
      this.refreshSessionPromise = null;
    }
  }
};
```

**Complexity**: 1 line fix (simple) or ~10 lines (with deduplication)
**Benefit**: Correct API behavior, Supabase compatibility

---

## Bug #3: Race Condition Between Concurrent Writes

**Severity**: 🟡 Medium
**Type**: Concurrency Issue
**Location**: `getSession()` line 224, `refreshSession()` line 239

### Description

When `getSession()` and `refreshSession()` (or multiple `getSession()` calls) execute concurrently, they can overwrite each other's cache writes in unpredictable order. The last writer wins, which may not be the newest data.

### Code Location

```typescript
// getSession() line 224
this.sessionStorage.set(session);

// refreshSession() calls getSession() which also writes
const sessionResult = await this.getSession(); // Writes cache at line 224
```

### Reproduction Scenario

```typescript
// Two concurrent calls
Promise.all([
  client.auth.getSession(),      // Thread 1
  client.auth.refreshSession(),  // Thread 2
]);
```

### Timeline

```
Thread 1: getSession()                  Thread 2: refreshSession() → getSession()
---------------------------------------------------------------------------------
t0: Check cache (miss)                  -
t1: Fetch session A (start) →           Check cache (miss)
t2: -                                   Fetch session B (start) →
t3: Session A returns                   -
t4: sessionStorage.set(A) →             Session B returns (newer!)
t5: Return A                            sessionStorage.set(B) ← Overwrites A!
t6: -                                   Return B
```

**Possible outcome 1**: Session B wins (newer data) ✅
**Possible outcome 2**: Session A wins (older data) ❌
**Problem**: Non-deterministic!

### Impact

- 🟡 Potentially stale data in cache for milliseconds
- 🟡 Inconsistent state between what caller receives and what's cached
- 🟡 Difficult to reproduce (timing-dependent)

### Frequency

- **Rare**: Requires precise timing of concurrent calls
- **More likely**: During rapid navigation or component remounting

### Real-World Impact

**Low severity because**:
- Both sessions are likely identical (same user, similar timestamps)
- Better Auth returns consistent data for same cookie
- Race window is narrow (~10-50ms)
- Eventually consistent via BroadcastChannel events

**Could be problematic if**:
- Session refresh happens during concurrent reads
- One call gets pre-refresh token, other gets post-refresh
- Cache ends up with older token

### Proposed Solution

Option 1: Promise deduplication (prevents concurrent fetches entirely):

```typescript
// If both calls share same promise, no race condition
if (this.getSessionPromise) {
  return await this.getSessionPromise; // Both callers wait for same result
}
```

Option 2: Timestamp-based conflict resolution:

```typescript
private lastWriteTimestamp = 0;

private setSessionIfNewer(session: Session): void {
  const now = Date.now();
  if (now > this.lastWriteTimestamp) {
    this.lastWriteTimestamp = now;
    this.sessionStorage.set(session);
  }
}
```

Option 3: Web Locks API (overkill):

```typescript
await navigator.locks.request('session-write', async () => {
  this.sessionStorage.set(session);
});
```

**Recommended**: Option 1 (promise deduplication) solves this as side effect
**Complexity**: No additional code if Bug #1 solution implemented

---

## Bug #4: Cross-Tab Cache Staleness

**Severity**: 🟡 Medium
**Type**: Consistency Issue
**Location**: All session operations (no cross-tab coordination)

### Description

When a user has multiple tabs open, each tab maintains independent session cache. If Tab 1 refreshes the session, Tab 2 doesn't know about it and continues using stale cached tokens. This can cause API calls from Tab 2 to fail with 401 errors.

### Reproduction Scenario

```typescript
// Tab 1: Open app
await client.auth.signIn({ email, password });
// Cache: session with token "abc123"

// Tab 2: Open app in another tab
await client.auth.getSession();
// Cache: session with token "abc123" (same)

// Later, in Tab 1: Refresh session
await client.auth.refreshSession();
// Tab 1 cache: session with token "xyz789" (new)
// Tab 2 cache: session with token "abc123" (stale!)

// In Tab 2: Make API call
const response = await client.from('users').select();
// ❌ 401 Unauthorized (token "abc123" is invalid after refresh)
```

### Impact

- 🟡 Tab 2 has stale tokens after Tab 1 refreshes
- 🟡 API calls from stale tab fail with 401
- 🟡 User confusion: "Why did my other tab log me out?"
- 🟡 Poor UX in multi-tab workflows

### Frequency

- **Whenever**: User has multiple tabs open
- **Common**: Power users, developers, anyone with "Open in new tab" habit

### Current Mitigation

You already have partial mitigation:
- `BroadcastChannel` exists (line 52) for auth state events
- `localStorage` events automatically fire across tabs
- Tabs will eventually sync via `notifyAllSubscribers()` calls

**However**: This only syncs during auth events (sign in, sign out), not during silent refreshes or explicit `refreshSession()` calls.

### Real-World Impact

**Medium severity because**:
- Better Auth's cookie-based sessions may auto-sync via browser cookies
- BroadcastChannel already handles sign in/out events
- Only affects explicit `refreshSession()` calls

**Could be problematic if**:
- Tab 1 calls `refreshSession()` (no broadcast currently!)
- Tab 2 tries to use cached token
- Server rejects old token

### Proposed Solution

Option 1: Broadcast refresh events:

```typescript
refreshSession: AuthClient['refreshSession'] = async () => {
  // Clear cache
  this.sessionStorage.clear();

  // Fetch fresh session
  const sessionResult = await this.getSession();

  // Notify other tabs to invalidate their cache
  this.broadcastChannel?.postMessage({
    type: 'SESSION_REFRESHED',
    session: sessionResult.data.session,
  });

  return { data: { ... }, error: null };
};

// In constructor, listen for broadcasts
this.broadcastChannel.onmessage = (event) => {
  if (event.data.type === 'SESSION_REFRESHED') {
    // Update our cache with fresh session from other tab
    if (event.data.session) {
      this.sessionStorage.set(event.data.session);
    }
  }
};
```

Option 2: Listen to `storage` events:

```typescript
// Browser fires 'storage' event when localStorage changes in other tabs
window.addEventListener('storage', (event) => {
  if (event.key === this.sessionStorage.storageKey) {
    // Session changed in another tab - invalidate our cache
    // Next getSession() will use new value from localStorage
  }
});
```

Option 3: Trust Better Auth's cookie sync (do nothing):

Since Better Auth uses cookies, the browser automatically syncs them across tabs. The next request from Tab 2 will use the refreshed cookie, and Better Auth will return the new session.

**Recommended**: Option 1 (broadcast) + Option 3 (trust cookies)
**Complexity**: ~10-15 lines
**Benefit**: Immediate cross-tab sync without waiting for next network request

---

## Summary Table

| Bug | Severity | Type | Impact | Frequency | Fix Complexity |
|-----|----------|------|--------|-----------|----------------|
| #1: Thundering Herd | 🔴 High | Performance | 10x network requests | Every cache miss | Low (~15 lines) |
| #2: refresh doesn't refresh | 🔴 Critical | Correctness | Wrong behavior | Every refresh call | Trivial (1 line) |
| #3: Write race condition | 🟡 Medium | Concurrency | Inconsistent state | Rare | None (fixed by #1) |
| #4: Cross-tab staleness | 🟡 Medium | Consistency | Stale tokens | Multi-tab usage | Low (~15 lines) |

---

## Recommended Fix Priority

### Phase 1: Critical Fixes (Must Have)
1. **Bug #2**: Add `this.sessionStorage.clear()` to `refreshSession()` (1 line)
2. **Bug #1**: Add promise deduplication to `getSession()` (~15 lines)

**Result**: Core correctness + 90% performance improvement

### Phase 2: Performance Optimizations (Should Have)
3. **Bug #4**: Add promise deduplication to `getJwtToken()` (~10 lines)

**Result**: Eliminates cascading requests

### Phase 3: Cross-Tab Improvements (Nice to Have)
4. **Bug #5**: Add BroadcastChannel for refresh events (~15 lines)

**Result**: Better multi-tab UX

**Total code added**: ~50-60 lines
**Benefit**: All bugs fixed without architectural changes

---

## Alternative: Full Rewrite

If you want to start fresh with a cleaner architecture, consider the "SessionCoordinator" pattern discussed in previous analysis. This would solve all bugs with a unified approach but requires ~100-150 lines of new code.

**Trade-off**: More code, but cleaner separation of concerns and easier to maintain.

---

## Decision Log

- [ ] Review each bug individually
- [ ] Decide fix priority (all? some? none?)
- [ ] Choose incremental fixes vs. full rewrite
- [ ] Implement chosen solution
- [ ] Add tests for race conditions
- [ ] Document new behavior
