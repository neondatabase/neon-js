# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A unified TypeScript SDK monorepo for Neon services, providing seamless integration with **Neon Auth** (authentication service) and **Neon Data API** (PostgreSQL database queries). Built with a Supabase-compatible interface for easy migration.

## Monorepo Structure

This is a Bun workspaces monorepo with two published packages:

### `@neondatabase/auth-js` (packages/auth/)
Authentication adapters implementing the Supabase-compatible `AuthClient` interface:
- **Better Auth Adapter** (Primary): Full-featured adapter with session caching, request deduplication, and cross-tab sync
- **Stack Auth Adapter** (Legacy): Maintained for backward compatibility

**Exports:**
- `@neondatabase/auth-js` - Main exports (AuthClient interface, adapters, utilities)
- `@neondatabase/auth-js/better-auth` - Better Auth adapter
- `@neondatabase/auth-js/stack-auth` - Stack Auth adapter

### `@neondatabase/neon-js` (packages/neon-js/)
Main SDK package that combines authentication with PostgreSQL querying:
- **NeonClient**: Unified client extending PostgrestClient
- **createClient()**: Factory function for Better Auth setup
- **CLI Tool**: Database type generation utility

**Exports:**
- `@neondatabase/neon-js` - Main exports (client, factory, adapters)
- `@neondatabase/neon-js/client` - Client components
- `@neondatabase/neon-js/cli` - CLI tool

## Development Commands

Run from repository root:

```bash
# Install dependencies
bun install

# Development (watch mode)
bun dev

# Build all packages
bun build

# Build specific package
bun run --filter '@neondatabase/auth-js' build

# Run tests
bun test              # Run all tests
bun test:node         # Node.js runtime (recommended for MSW)
bun test:ci           # CI mode (no watch)

# Type checking
bun typecheck

# Publishing
bun release           # Bump version and publish both packages
```

## Architecture

### Authentication Layer (`packages/auth/`)

**Core Interface**: `src/auth-interface.ts`
- Defines `AuthClient` interface (Supabase-compatible)
- Error types: `AuthError`, `AuthApiError`

**Adapters**: `src/adapters/`
- **Better Auth** (Primary): `adapters/better-auth/`
  - `better-auth-adapter.ts` - Main implementation (~1820 lines)
  - `better-auth-types.ts` - Type definitions
  - `better-auth-helpers.ts` - Session mapping and error handling
  - `in-flight-request-manager.ts` - Request deduplication utility
  - `constants.ts` - Configuration (TTLs, intervals, buffers)
  - Session caching with TTL-based expiration
  - Request deduplication for `getSession()` and `getJwtToken()`
  - Cross-tab sync via BroadcastChannel (browser only)
  - Token refresh detection (30s polling interval)

- **Stack Auth** (Legacy): `adapters/stack-auth/`
  - `stack-auth-adapter.ts` - Full implementation (2000+ lines)
  - `stack-auth-types.ts` - Type definitions
  - `stack-auth-schemas.ts` - Zod schemas
  - `stack-auth-helpers.ts` - JWT utilities

- **Shared**: `adapters/shared-helpers.ts`, `adapters/shared-schemas.ts`

**Tests**: `src/__tests__/`
- Uses real Stack/Better Auth SDKs with MSW for network mocking
- Run with `bun test:node` for reliable MSW interception

### Client Layer (`packages/neon-js/`)

**Client**: `src/client/`
- `neon-client.ts` - NeonClient class (extends PostgrestClient)
- `client-factory.ts` - Better Auth factory: `createClient()`
- `client-factory-stack-auth.ts` - Legacy Stack Auth factory
- `fetch-with-auth.ts` - Auth-aware fetch wrapper

**CLI Tool**: `src/cli/`
- `index.ts` - CLI entry point (bin: `neon-js`)
- `commands/gen-types.ts` - Type generation command
- `commands/generate-types.ts` - Core logic using postgres-meta
- `utils/parse-duration.ts` - Duration parsing

## Usage

### Basic Setup (Better Auth)

```typescript
import { createClient } from '@neondatabase/neon-js';

const client = createClient({
  url: 'https://your-neon-api.com',
  auth: {
    baseURL: 'https://your-auth-server.com',
  },
  options: {
    global: {
      headers: { 'X-Custom-Header': 'value' },
    },
    db: {
      schema: 'public',
    },
  },
});

// Auth methods (Supabase-compatible)
await client.auth.signInWithPassword({ email, password });
const { data } = await client.auth.getSession();

// Database queries (automatic token injection)
const { data: items } = await client.from('items').select();
```

### Using Auth Adapters Directly

```typescript
import { BetterAuthAdapter } from '@neondatabase/auth-js/better-auth';

const auth = new BetterAuthAdapter({
  baseURL: 'https://your-auth-server.com',
});

await auth.signInWithPassword({ email, password });
```

## Better Auth Adapter Features

### Session Caching
- In-memory cache with 60s TTL (or until JWT expires)
- TTL calculated from JWT `exp` claim minus clock skew buffer
- Lazy expiration checked on reads
- Synchronous cache clearing on sign-out
- Invalidation flag prevents race conditions

### Request Deduplication
- Multiple concurrent `getSession()`/`getJwtToken()` calls deduplicate to single request
- 10x faster cold starts (10 concurrent calls: ~2000ms → ~200ms)
- Reduces server load by N-1 for N concurrent calls
- Implemented via generic `InFlightRequestManager`

### Event System
- `onAuthStateChange()` monitors: `SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`, `USER_UPDATED`
- Synchronous emission in state-changing methods
- Cross-tab sync via BroadcastChannel (browser only)
- Token refresh detection via 30s polling

### Performance
- Cached `getSession()`: <1ms (in-memory, no I/O)
- Cold start `getSession()`: ~200ms (single network call)
- Concurrent cold start: ~200ms total (deduplicated)
- Token refresh: <200ms (automatic)
- Cross-tab sync: <50ms (BroadcastChannel)

## Environment Compatibility

Works in both browser and Node.js:
- **Browser**: Full features including cross-tab sync
- **Node.js**: Core auth works, browser-only features auto-disabled

## Testing

Tests use real SDKs with MSW for network mocking:
- Verifies retrocompatibility with Supabase AuthClient API
- Catches breaking changes in Stack/Better Auth SDK versions
- Located in `packages/auth/src/__tests__/`

**Run tests:**
```bash
bun test:node    # Recommended (reliable MSW)
npx vitest       # Alternative
bun test         # May have MSW issues with Bun's fetch
```

## Code Style

```typescript
// TypeScript strict mode enabled
// Functional patterns preferred
// NO "I" prefix in interface names
// Absolute imports using workspace protocol: '@neon-js/auth'
```

## Key Mappings (Better Auth)

Following the [Better Auth Supabase Migration Guide](https://www.better-auth.com/docs/guides/supabase-migration-guide):

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

## Additional Documentation

- `packages/auth/src/adapters/better-auth/better-auth-docs.md` - Comprehensive adapter docs
- `packages/auth/src/adapters/better-auth/better-auth-plugins.md` - Plugin configuration
- `packages/auth/src/__tests__/README.md` - Testing guide
- `BETTER_AUTH_SIMPLIFICATION.md` - Simplification strategy
- `REMOVE_BETTER_AUTH_SESSION_LISTENER.md` - Event implementation notes

## References

- [Better Auth Docs](https://www.better-auth.com/docs)
- [Better Auth Supabase Migration Guide](https://www.better-auth.com/docs/guides/supabase-migration-guide)
- [Supabase Auth Client](https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/SupabaseAuthClient.ts)
- [PostgrestClient](https://github.com/supabase/postgrest-js)
