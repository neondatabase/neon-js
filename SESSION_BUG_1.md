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