# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a TypeScript SDK that provides a unified authentication interface based on Supabase's auth API. The project uses an adapter pattern to support multiple authentication providers while maintaining a consistent API.

## Architecture
- **Core Interface**: `src/auth/auth-interface.ts` defines the `AuthClient` interface based on Supabase's AuthClient
- **Adapter Pattern**: Authentication providers implement the `AuthClient` interface
- **Adapters**: Located in `src/auth/adapters/`
  - `src/auth/adapters/stack-auth/` - Stack Auth provider adapter directory
    - `stack-auth-adapter.ts` - Main adapter implementation (1800+ lines, all methods implemented)
    - `stack-auth-types.ts` - TypeScript type definitions and interfaces
    - `stack-auth-schemas.ts` - Zod schemas for JWT validation
    - `stack-auth.test.ts` - Comprehensive unit tests (40+ test cases)
- **Client Layer**: `src/client/` contains the unified client
  - `neon-client.ts` - Main NeonClient class (extends PostgrestClient)
  - `client-factory.ts` - Factory function `createClient()` for creating authenticated NeonClient instances
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
- `bun test` - Run unit tests with vitest
- `bun typecheck` - Run TypeScript type checking
- `bun release` - Bump version and publish to npm



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

### Usage with NeonClient:
```typescript
import { createClient } from 'neon-js';

// Create client with Stack Auth integration
const client = createClient({
  url: 'https://your-api.com',
  auth: {
    projectId: 'your-project-id',
    publishableClientKey: 'pk_...',
    tokenStore: 'cookie', // or 'memory'
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

// Access auth methods
await client.auth.signInWithPassword({ email, password });
const { data } = await client.auth.getSession();

// Make authenticated API calls (tokens injected automatically)
const { data: items } = await client.from('items').select();
```

### Performance Characteristics:
- **Cached `getSession()`**: <5ms (reads from Stack Auth internal cache, no I/O)
- **First `getSession()` after reload**: <50ms (Stack Auth reads from tokenStore)
- **Token refresh**: <200ms (network call to Stack Auth, happens automatically)

## Testing
- Test framework: Vitest
- Tests located in:
  - `tests/` directory - Integration tests
  - `src/auth/adapters/stack-auth/stack-auth.test.ts` - Stack Auth adapter unit tests
  - `src/client/neon-client.test.ts` - NeonClient unit tests
- Run tests with `bun test`

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
1. Instantiates `StackAuthAdapter` from auth options
2. Creates a lazy `getAccessToken()` function that calls `auth.getSession()`
3. Wraps fetch with `fetchWithAuth()` to automatically inject Bearer tokens
4. Constructs `NeonClient` with the auth-aware fetch and optional configuration (custom headers, fetch, schema)
5. Assigns the auth adapter to `client.auth` for direct access

This pattern ensures all PostgrestClient queries automatically include authentication headers.

**Signature:**
```typescript
createClient<Database, SchemaName>({
  url: string,
  auth: StackAuthOptions,
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

### CLI Tool:
The package includes a `neon-js` CLI command for generating TypeScript types from database schemas:
- **Command**: `npx neon-js gen-types --db-url <url> [options]`
- **Implementation**: Uses Supabase's `postgres-meta` library to introspect database schema
- **Features**: Multi-schema support, PostgREST v9 compatibility mode, configurable query timeouts
- **Output**: Generates TypeScript type definitions compatible with `@supabase/postgrest-js`



## Additional Documentation

- **`stack-auth_supabase-comparison.md`**: Comprehensive feature comparison between Stack Auth and Supabase, demonstrating that Stack Auth implements all required features (refresh deduplication, exponential backoff, session validation, user caching) and in many cases provides superior implementations. This document validates the adapter's reliance on Stack Auth's internal mechanisms.

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