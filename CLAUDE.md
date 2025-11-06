# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a unified TypeScript SDK for Neon services, providing seamless integration with **Neon Auth** (authentication service) and **Neon Data API** (PostgreSQL database queries). The SDK uses an adapter pattern to support multiple authentication providers while maintaining a Supabase-compatible interface for easy migration and familiar developer experience.

**Current Status**: The project now features a **Better Auth adapter** as the primary authentication provider, alongside the Stack Auth adapter for backward compatibility.

## Architecture
- **Core Interface**: `src/auth/auth-interface.ts` defines the `AuthClient` interface for Neon Auth, maintaining Supabase API compatibility to enable seamless migration from Supabase projects
- **Adapter Pattern**: Authentication providers implement the `AuthClient` interface
- **Adapters**: Located in `src/auth/adapters/`
  - **Better Auth** (Primary): `src/auth/adapters/better-auth/`
    - `better-auth-adapter.ts` - Main adapter implementation (46KB, ~1500 lines)
    - `better-auth-types.ts` - TypeScript type definitions and interfaces
    - `better-auth-schemas.ts` - Zod schemas for validation
    - `better-auth-helpers.ts` - Helper utilities for session mapping and error handling
    - `better-auth-docs.md` - Comprehensive adapter documentation
    - `better-auth-plugins.md` - Plugin configuration guide
    - `better-auth-checklist.md` - Implementation checklist
  - **Stack Auth** (Legacy): `src/auth/adapters/stack-auth/`
    - `stack-auth-adapter.ts` - Main adapter implementation (2000+ lines, all methods implemented)
    - `stack-auth-types.ts` - TypeScript type definitions and interfaces
    - `stack-auth-schemas.ts` - Zod schemas for JWT validation
    - `stack-auth-helpers.ts` - Helper utilities for JWT decoding and error handling
  - **Shared Utilities**:
    - `shared-helpers.ts` - Common helper functions across adapters
    - `shared-schemas.ts` - Shared Zod schemas
- **Utilities**: `src/auth/utils.ts` - Shared utility functions (e.g., `toISOString()` for date conversion)
- **Client Layer**: `src/client/` contains the unified client
  - `neon-client.ts` - Main NeonClient class (extends PostgrestClient)
  - `client-factory.ts` - Factory function `createClient()` using Better Auth adapter
  - `client-factory_stack_auth.ts` - Legacy Stack Auth factory implementation
  - `neon-client.test.ts` - Client tests
  - `fetch-with-auth.ts` - Auth-aware fetch wrapper for automatic token injection
- **CLI Tool**: `src/cli/` contains command-line interface utilities
  - `index.ts` - CLI entry point (bin: `neon-js`)
  - `commands/gen-types.ts` - Type generation command with flag parsing
  - `commands/generate-types.ts` - Core type generation logic using Supabase's postgres-meta
  - `utils/parse-duration.ts` - Duration parsing utility for query timeouts
- **Entry Point**: `src/index.ts` exports the interface types, adapters, and client
- **Build Output**: Compiled to `dist/` directory

## Development Commands
- `bun dev` - Start development server with watch mode
- `bun build` - Build the project for production
- `bun test` - Run unit tests with vitest (may have MSW interception issues)
- `bun test:node` - **Recommended**: Run tests in pure Node.js runtime (reliable MSW mocking)
- `npx vitest` - Alternative: Direct Vitest execution, bypasses Bun entirely
- `bun test:ci` - Run tests once without watch mode (for CI/CD)
- `bun typecheck` - Run TypeScript type checking
- `bun release` - Bump version and publish to npm

### Testing Notes
When running tests with `bun test`, MSW (Mock Service Worker) may fail to intercept HTTP requests due to Bun's fetch implementation interfering with Node.js runtime. Use `bun test:node` or `npx vitest` for reliable test execution with proper mocking.



## Better Auth Adapter (Primary)

The Better Auth adapter provides a direct 1:1 mapping from Supabase Auth API to Better Auth, following the [official Better Auth Supabase Migration Guide](https://www.better-auth.com/docs/guides/supabase-migration-guide).

### Key Mappings:

**Authentication:**
- `signUp` → `betterAuth.signUp.email()`
- `signInWithPassword` → `betterAuth.signIn.email()`
- `signInWithOAuth` → `betterAuth.signIn.social()`
- `signInWithOtp` → `betterAuth.signIn.email()` (magic link)
- `signOut` → `betterAuth.signOut()`

**Session Management:**
- `getSession` → `betterAuth.getSession()`
- `getUser` → `betterAuth.getSession()` (extract user)

**User Management:**
- `updateUser` → `betterAuth.user.update()`
- `getUserIdentities` → `betterAuth.account.list()`
- `linkIdentity` → `betterAuth.linkSocial()`
- `unlinkIdentity` → `betterAuth.account.unlink()`

**Password Management:**
- `resetPasswordForEmail` → `betterAuth.forgetPassword()`

### Plugin Configuration:

The adapter uses Better Auth's plugin system with three default plugins:
- `jwtClient()` - JWT token management
- `adminClient()` - Admin API access
- `organizationClient()` - Multi-tenancy support

### Environment Compatibility:

Works in both browser and Node.js with graceful degradation:
- **Browser**: Full feature support including cross-tab sync via BroadcastChannel
- **Node.js**: Core auth works, browser-only features auto-disabled

### Implementation Details:

The adapter implements sophisticated state management:
- **Token refresh detection**: Automatic polling (30s interval) to detect token refreshes
- **Cross-tab synchronization**: BroadcastChannel for auth state sync across tabs (browser only)
- **Event system**: `onAuthStateChange()` for monitoring `SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`, `USER_UPDATED` events
- **Session mapping**: Transforms Better Auth sessions to Supabase-compatible format

See `BETTER_AUTH_SIMPLIFICATION.md` for detailed implementation notes and simplification strategy.

## Stack Auth Adapter (Legacy)

**Note**: The Stack Auth adapter is maintained for backward compatibility but is no longer the primary adapter. New projects should use Better Auth.

## Stack Auth Session Caching

The Stack Auth adapter optimizes session retrieval by accessing Stack Auth's internal session cache directly:

### Implementation Details:
The adapter uses an internal method `_getCachedTokensFromStackAuthInternals()` that:
1. Accesses Stack Auth's internal `_getOrCreateTokenStore()` method
2. Retrieves the session from the token store using `_getSessionFromTokenStore()`
3. Checks if cached tokens are still valid via `getAccessTokenIfNotExpiredYet(0)`
4. Returns `null` if tokens are expired, forcing a refresh

### How `getSession()` Works:
1. **Step 1 - Fast Path**: Try to get cached tokens from Stack Auth internals (no network/storage access)
   - If cached tokens exist and are valid, decode JWT and return session immediately
2. **Step 2 - Fallback**: If no cached tokens or expired, fetch user via `stackAuth.getUser()`
   - This makes a network request and automatically refreshes tokens if needed
   - Extract tokens from user session and construct session object

### Token Format:
Stack Auth's internal tokens are objects with a `token` property:
```typescript
{
  accessToken: { token: "eyJ..." },
  refreshToken: { token: "d37..." }
}
```
The adapter extracts these token strings for session management and JWT decoding using Zod schemas.

### Usage with NeonClient (Better Auth):
```typescript
import { createClient } from 'neon-js';

// Create client with Better Auth integration
const client = createClient({
  url: 'https://your-api.com',
  auth: {
    baseURL: 'https://your-auth-server.com',
    // Optional: custom configuration
    config: {
      enableTokenRefreshDetection: true,
      tokenRefreshCheckInterval: 30_000,
    },
  },
  options: {
    // Optional: custom fetch, headers, schema
    global: {
      headers: { 'X-Custom-Header': 'value' },
    },
    db: {
      schema: 'public',
    },
  },
});

// Access auth methods (Supabase-compatible API)
await client.auth.signInWithPassword({ email, password });
const { data } = await client.auth.getSession();

// Make authenticated API calls (tokens injected automatically)
const { data: items } = await client.from('items').select();
```

### Usage with Stack Auth (Legacy):
See `src/client/client-factory_stack_auth.ts` for Stack Auth implementation details.

### Performance Characteristics:
- **Cached `getSession()`**: <5ms (reads from Stack Auth internal cache, no I/O)
- **First `getSession()` after reload**: <50ms (Stack Auth reads from tokenStore)
- **Token refresh**: <200ms (network call to Stack Auth, happens automatically)

## Environment Compatibility

The Stack Auth adapter supports both browser and Node.js environments with graceful feature degradation:

### Browser Environment:
- Full feature support including cross-tab authentication state synchronization via BroadcastChannel
- Token refresh detection with automatic state change events
- Session caching optimizations

### Node.js Environment:
- All core authentication methods work (signIn, signOut, getSession, etc.)
- Session management and token refresh (without cross-tab sync)
- Graceful degradation - browser-only features are automatically disabled

### Implementation Details:
The adapter uses environment detection helpers (`isBrowser()`, `supportsBroadcastChannel()`) to conditionally enable browser-specific APIs. This follows the same pattern as Supabase's auth-js library.

**Browser-only features:**
- BroadcastChannel for cross-tab state synchronization
- Automatically disabled in Node.js without errors

**Universal features (work in both):**
- All authentication methods (signUp, signIn, signOut)
- Session management (getSession, refreshSession)
- User management (getUser, updateUser)
- OAuth flows (with appropriate redirect handling)
- State change listeners (onAuthStateChange)

### Testing:
```bash
# Run tests in Node.js environment (default)
bun test

# Run specific test files
bun test src/auth/__tests__/stack-auth-helpers.test.ts

# Browser-specific OAuth tests use jsdom environment
bun test src/auth/__tests__/oauth.browser.test.ts
```

## Testing Architecture

Tests use the **real `@stackframe/js` SDK** with **MSW for network mocking only**:

- **SDK**: Real Stack Auth SDK with `tokenStore: 'memory'` for Node.js compatibility
- **Network**: MSW intercepts HTTP requests to Stack Auth API
- **Goal**: Verify retrocompatibility with Supabase AuthClient API

### Why Real SDK in Tests?

By testing against the real Stack Auth SDK:
- ✅ We catch breaking changes in Stack Auth SDK versions
- ✅ We verify the adapter actually works with Stack Auth (not just our assumptions)
- ✅ We ensure Supabase API compatibility is maintained
- ✅ We reduce maintenance burden (single mock layer instead of two)

### Test Files

- Test framework: Vitest
- Tests located in:
  - `src/auth/__tests__/` - Complete test suite
    - `auth-flows.test.ts` - Core authentication flows
    - `session-management.test.ts` - Session lifecycle and tokens
    - `error-handling.test.ts` - Error scenarios
    - `oauth.test.ts` - OAuth provider flows (Node.js environment)
    - `oauth.browser.test.ts` - OAuth browser-specific tests (jsdom environment)
    - `otp.test.ts` - OTP/magic link authentication
    - `user-management.test.ts` - User profile operations
    - `stack-auth-helpers.test.ts` - JWT and error utilities
    - `supabase-compatibility.test.ts` - Interface compatibility verification
    - `msw-setup.ts` - MSW server configuration
    - `msw-handlers.ts` - Mock HTTP endpoints
    - `README.md` - Detailed testing documentation
  - `src/client/` - NeonClient tests (legacy)
- Run tests with: `bun test`, `bun test:node`, or `npx vitest`

### Adding Tests

1. Create adapter with `tokenStore: 'memory'`:
   ```typescript
   const adapter = new StackAuthAdapter({
     projectId: 'test-project',
     publishableClientKey: 'test-key',
     tokenStore: 'memory',  // Node.js compatibility
   });
   ```

2. Set up test fixtures in `beforeEach()`:
   ```typescript
   server.use(...stackAuthHandlers);
   resetMockDatabase();
   // Fresh adapter instance = clean session
   ```

3. Write assertions for Supabase-compatible behavior

See `src/auth/__tests__/README.md` for detailed testing documentation.

## Key Implementation Notes

### Recent Implementations (October 2025):

#### Complete AuthClient Interface Coverage
All 25+ authentication methods from the Supabase AuthClient interface are now fully implemented:
- **Supported methods**: signUp, signInWithPassword, signInWithOAuth, signInWithOtp, verifyOtp, getSession, refreshSession, setSession, getUser, updateUser, getClaims, getUserIdentities, linkIdentity, unlinkIdentity, signOut, resetPasswordForEmail, resend, reauthenticate, exchangeCodeForSession, onAuthStateChange, and internal utilities
- **Unsupported methods with detailed error responses**: signInWithIdToken, signInWithSSO, signInWithWeb3, signInAnonymously
  - Each unsupported method returns a comprehensive `AuthError` explaining why Stack Auth doesn't support it and suggesting alternatives
  - Includes context about what was attempted (provider, chain, etc.) for debugging
  - Error codes: `id_token_provider_disabled`, `sso_provider_disabled`, `web3_provider_disabled`

#### Session Caching Optimization
The Stack Auth adapter was refactored to access Stack Auth's internal session cache directly via `_getCachedTokensFromStackAuthInternals()`. This optimization:
- Eliminates unnecessary network calls on cached `getSession()` invocations
- Maintains compatibility with Stack Auth's tokenStore persistence (cookie/memory)
- Uses internal APIs: `_getOrCreateTokenStore()`, `_getSessionFromTokenStore()`, and `getAccessTokenIfNotExpiredYet()`

#### Important Limitations & Unsupported Patterns

**Password Updates**: Stack Auth requires `oldPassword` for password changes, unlike Supabase which uses a nonce-based reauthentication flow. The `updateUser()` method with password attribute will return an error directing users to:
1. Use the "Forgot Password" flow via `resetPasswordForEmail()`
2. Reauthenticate using `signInWithPassword()` with their old credentials
3. Use Stack Auth's native `updatePassword()` method directly

**Anonymous Authentication**: Stack Auth's anonymous sign-in implementation differs from Supabase. Method returns an error with guidance to use explicit email/password or OAuth flows instead.

**Unsupported Enterprise Features**:
- **SAML SSO** (signInWithSSO): Stack Auth only supports OAuth social providers, not enterprise SAML identity providers
- **Direct OIDC ID Token** (signInWithIdToken): Stack Auth uses OAuth authorization code flow; redirect-based OAuth is required
- **Web3/Crypto Wallets** (signInWithWeb3): Stack Auth does not support blockchain-based authentication

All unsupported methods provide detailed error messages with suggested alternatives to guide developers toward working approaches.

### Factory Pattern:
The `createClient()` factory function (located in `src/client/client-factory.ts`) handles the complex initialization sequence:
1. Instantiates `BetterAuthAdapter` from auth options
2. Creates a lazy `getAccessToken()` function that calls `auth.getJwtToken()`
3. Wraps fetch with `fetchWithAuth()` to automatically inject Bearer tokens
4. Constructs `NeonClient` with the auth-aware fetch and optional configuration (custom headers, fetch, schema)
5. Assigns the auth adapter to `client.auth` for direct access

This pattern ensures all PostgrestClient queries automatically include authentication headers.

**Signature:**
```typescript
createClient<Database, SchemaName>({
  url: string,
  auth: BetterAuthOptions,
  options?: {
    global?: {
      fetch?: typeof fetch,
      headers?: Record<string, string>
    },
    db?: {
      schema?: SchemaName
    }
  }
}): NeonClient<Database, SchemaName>
```

**Generic Parameters:**
- `Database`: Database schema type (defaults to `any`)
- `SchemaName`: Schema name (defaults to `'public'` if present in Database, otherwise string key)

**Note**: A legacy Stack Auth factory is available at `src/client/client-factory_stack_auth.ts`

### CLI Tool:
The package includes a `neon-js` CLI command for generating TypeScript types from database schemas:
- **Command**: `npx neon-js gen-types --db-url <url> [options]`
- **Implementation**: Uses Supabase's `postgres-meta` library to introspect database schema
- **Features**: Multi-schema support, PostgREST v9 compatibility mode, configurable query timeouts
- **Output**: Generates TypeScript type definitions compatible with `@supabase/postgrest-js`



## Additional Documentation

- **`BETTER_AUTH_SIMPLIFICATION.md`**: Documents the Better Auth adapter simplification strategy, showing the direct 1:1 mappings from Supabase Auth to Better Auth following the official migration guide
- **`intelligence/stack-auth_supabase-comparison.md`**: Comprehensive feature comparison between Stack Auth and Supabase, demonstrating that Stack Auth implements all required features (refresh deduplication, exponential backoff, session validation, user caching) and in many cases provides superior implementations
- **`intelligence/auth-feature-comparison.md`**: Detailed comparison of authentication features across providers
- **`src/auth/adapters/better-auth/better-auth-docs.md`**: Comprehensive Better Auth adapter documentation
- **`src/auth/adapters/better-auth/better-auth-plugins.md`**: Better Auth plugin configuration guide
- **`src/auth/adapters/better-auth/better-auth-checklist.md`**: Implementation checklist for the Better Auth adapter

## Supabase references

- [SupabaseAuthClient.ts](https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/SupabaseAuthClient.ts) - Main implementation
- [SupabaseClient.ts](https://github.com/supabase/supabase-js/blob/master/packages/core/supabase-js/src/SupabaseClient.ts) - Main implementation

# IMPORTANT
<code-style>
  - TypeScript strict mode enabled
  - Use functional patterns where possible
  - AVOID the "I" prefix in interface names
  - ALWAYS use absolute imports following the `@/` pattern
</code-style>