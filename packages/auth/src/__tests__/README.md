# Stack Auth Adapter Tests

Integration tests for the Stack Auth adapter implementation using the real Stack Auth SDK with MSW network mocking.

## Overview

These tests verify that our Stack Auth adapter correctly implements the Supabase `AuthClient` interface by testing all major authentication flows and edge cases against the **real Stack Auth SDK**.

## Testing Architecture

Our tests use the **real `@stackframe/js` SDK** with **MSW for network interception only**:

```
Test → StackAuthAdapter → Real Stack Auth SDK → fetch() → MSW intercepts → mock response
```

### Why This Approach?

By testing against the real Stack Auth SDK:
- ✅ We catch breaking changes in Stack Auth SDK versions
- ✅ We verify the adapter actually works with Stack Auth (not just our assumptions)
- ✅ We ensure Supabase API compatibility is maintained
- ✅ We reduce maintenance burden (single mock layer instead of two)

### Key Components

- **Real SDK**: `@stackframe/js` with `tokenStore: 'memory'` for Node.js compatibility
- **MSW Setup** (`msw-setup.ts`): Sets up MSW server and lifecycle hooks
- **HTTP Mocks** (`msw-handlers.ts`): Mocks Stack Auth HTTP API endpoints
- **Test Files**: Use real SDK, verify Supabase-compatible behavior

## File Structure

```
src/auth/__tests__/
├── msw-setup.ts                    # MSW server configuration
├── msw-handlers.ts                 # Mock Stack Auth HTTP endpoints
├── auth-flows.test.ts              # Core auth flows (signup, signin, signout)
├── oauth.test.ts                   # OAuth error handling (Node.js)
├── oauth.browser.test.ts           # OAuth provider flows (Node.js with patched globals)
├── otp.test.ts                     # OTP/magic link authentication
├── error-handling.test.ts          # Error scenarios and edge cases
├── user-management.test.ts         # User profile management
├── session-management.test.ts      # Session lifecycle and tokens
├── stack-auth-helpers.test.ts      # JWT and error normalization tests
├── supabase-compatibility.test.ts  # Interface implementation verification
└── README.md                        # This file
```

## Browser vs Node.js Test Environments

### Node.js Tests (Default)
Most tests run in Node.js environment using `tokenStore: 'memory'`:
- ✅ Password authentication (signup, signin)
- ✅ OTP/Magic link flows
- ✅ Session management
- ✅ User profile updates
- ✅ Error handling

### Browser-like Tests (No jsdom needed!)
OAuth flows require browser APIs, but we test them in Node.js using Stack Auth's own pattern:
- 🌐 `oauth.browser.test.ts` - OAuth provider flows
- **No jsdom required** - patches `globalThis.window` and `globalThis.document` directly
- Captures redirect URLs by mocking `window.location.assign()`
- Throws intentional error to abort redirect flow

**How it works:**
Following [Stack Auth's own e2e testing approach](https://github.com/stack-auth/stack/blob/main/apps/e2e/tests/js/oauth.test.ts):

```typescript
// Patch globals
const previousWindow = globalThis.window;
const previousDocument = globalThis.document;
let capturedUrl: string | null = null;

globalThis.document = { cookie: '', createElement: () => ({}) };
globalThis.window = {
  location: {
    href: 'http://localhost:3000',
    assign: (url: string) => {
      capturedUrl = url;
      throw new Error('INTENTIONAL_TEST_ABORT');
    },
  },
};

try {
  // This will throw INTENTIONAL_TEST_ABORT
  await adapter.signInWithOAuth({ provider: 'google' });
} finally {
  // Restore globals
  globalThis.window = previousWindow;
  globalThis.document = previousDocument;
}

// Verify captured URL
expect(capturedUrl).toContain('google');
```

**Why this approach?**
- ✅ Tests real Stack Auth SDK behavior (not mocked)
- ✅ Avoids jsdom compatibility issues
- ✅ Same pattern Stack Auth uses themselves
- ✅ Simpler and more reliable than browser simulation

## Running Tests

```bash
# Run all tests
bun test

# Run specific test suite
bun test src/auth/__tests__/auth-flows.test.ts

# Watch mode
bun test --watch

# With coverage
bun test -- --coverage
```

## Test Coverage

- **Authentication Flows** (Node.js) - signup, signin, signout, session management
- **OAuth** (Node.js with patched globals) - Google, GitHub, Microsoft and other provider flows
- **OAuth Error Handling** (Node.js) - Environment detection, error responses
- **OTP/Magic Link** (Node.js) - Passwordless authentication
- **Error Handling** (Node.js) - Network errors, validation, rate limiting
- **User Management** (Node.js) - Profile updates, metadata handling
- **Session Management** (Node.js) - Token lifecycle, refresh, expiry
- **Supabase Compatibility** (Node.js) - Interface implementation, response formats

## How It Works

1. Tests create `StackAuthAdapter` instances with `tokenStore: 'memory'`
2. Adapter initializes real Stack Auth SDK (StackClientApp or StackServerApp)
3. SDK makes HTTP requests to Stack Auth API
4. MSW intercepts these requests and returns mock responses
5. Our adapter transforms Stack Auth responses to Supabase format
6. Tests verify Supabase-compatible behavior

### Node.js Compatibility

The real Stack Auth SDK works in Node.js test environments using `tokenStore: 'memory'`:

```typescript
const adapter = new StackAuthAdapter({
  projectId: 'test-project',
  publishableClientKey: 'test-key',
  tokenStore: 'memory',  // No browser APIs needed!
});
```

## Adding New Tests

1. Choose the appropriate test suite file (or create a new one)
2. In `beforeEach()`:
   ```typescript
   server.use(...stackAuthHandlers);
   resetMockDatabase();
   // Fresh adapter instance per test = clean session
   ```
3. Create adapter with: `new StackAuthAdapter({ ... })`
4. Write assertions for Supabase-compatible behavior

**Example:**

```typescript
it('should handle new scenario', async () => {
  const adapter = new StackAuthAdapter({
    projectId: 'test-project',
    publishableClientKey: 'test-key',
    tokenStore: 'memory',
  });

  const result = await adapter.someMethod({ ... });

  expect(result.error).toBeNull();
  expect(result.data).toBeTruthy();
});
```

## Test Isolation

- **Fresh adapter per test**: Each test creates new `StackAuthAdapter` instance
- **Database reset**: `resetMockDatabase()` clears mock user/session data
- **Handler reset**: `server.resetHandlers()` runs after each test
- **No shared state**: Sessions don't leak between tests

## Test Philosophy

These tests focus on **behavior** rather than implementation details:

- ✅ Test what the adapter does (behavior)
- ✅ Test edge cases and error scenarios
- ✅ Test the full integration path with real SDK
- ✅ Verify Supabase interface compatibility
- ❌ Don't test internal implementation details
- ❌ Don't test Stack Auth SDK itself (we use it as-is)

## Migration from Dual Mocking

Previous versions used both SDK mocking and MSW. We've simplified to MSW-only:

**Before**: Mock SDK → fetch() → MSW intercepts
**After**: Real Stack Auth SDK → fetch() → MSW intercepts

This change required updating all test helpers to use `tokenStore: 'memory'` and removing `resetMockSession()` calls.

## Dependencies

- **vitest** - Test runner
- **msw** - HTTP API mocking
- **@stackframe/js** - Real Stack Auth SDK
- **@supabase/auth-js** - Supabase auth types (for interface compatibility)

---

For questions or issues with tests, check the test files themselves - they're well-commented and follow consistent patterns.
