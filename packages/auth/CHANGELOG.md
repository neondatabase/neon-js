# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [Unreleased]

### Added

- **Session Data Caching**: Next.js SDK now caches session details with `session_data` cookie. 
  - The cookie is JWT token with session and user details
  - The cookie needs to be signed with 32-characters long - `cookies.secret` 
  - The `/api/auth/get-session`, `auth.getSession()` and the middleware will try to parse user details from 
    `session_data` cookie with fallback on upstream `/get-session` 
  - The cookie has default 5 minutes TTL, can be customized with `cookies.sessionDataTtl`

- **Cross Domain Cookie**: Next.js SDK now supports settings `domain` attribute on cookie
  - Optional `cookie.domain` for cross-subdomain cookie sharing

- **Unified Entry Point**: New `createNeonAuth()` combines all server functionality in one place
  - Returns an object with all Better Auth server methods (spread from base server)
  - `.handler()` method for API route handlers (GET, POST, PUT, DELETE, PATCH)
  - `.middleware(config?)` method for route protection and session management
  - Single import instead of 3 separate imports
  - Config defined once, used everywhere

- **Framework-Agnostic Architecture**: All business logic moved to `packages/auth/src/server/`
  - New `server/proxy/` utilities (handler, request, response)
  - New `server/middleware/` utilities (processor, oauth, session, route-protection)
  - New `server/config.ts` with framework-agnostic config types
  - Next.js files now thin adapters (~40-50 lines, 38% smaller)

- **Required Configuration**: Explicit configuration with validation
  - `NeonAuthConfig` type with required `baseUrl` and `cookies` configuration
  - No more implicit environment variable fallbacks

### Changed

- **BREAKING**: Changed `createAuthServer()` to `createNeonAuth()` with explicit config
  - `baseUrl` and `cookies.secret` are mandatory parameters
  - No fallback to `process.env.NEON_AUTH_BASE_URL` or other environment variables
  - Environment variables must be explicitly passed to config objects

### Removed

- **BREAKING**: Removed `neonAuth()` utility function
  - Use `auth.getSession()` from `createNeonAuth()` instead
  - Returns consistent `{ data: session, error: null }` format
- **BREAKING**: `authApiHandler()` and `neonAuthMiddleware()` direct exports
  - Use `auth.handler()` from `createNeonAuth()` instead
  - Use `auth.middleware()` from `createNeonAuth()` instead

### Migration Guide

#### 1. Unified Entry Point

**Before:**
```typescript
// app/api/auth/[...path]/route.ts
import { authApiHandler } from '@neondatabase/auth/next/server'; // ❌ No longer works

export const { GET, POST } = authApiHandler();  // ❌ No longer works

// middleware.ts
import { neonAuthMiddleware } from '@neondatabase/auth/next/server'; // ❌ No longer works

export default neonAuthMiddleware({       // ❌ No longer works
  loginUrl: '/auth/sign-in',
});


// lib/auth/server.ts
import { createAuthServer } from '@neondatabase/auth/next/server'; // ❌ No longer works

export const authServer = createAuthServer();     // ❌ No longer works, 

// app/components/header.tsx
import { neonAuth } from '@neondatabase/auth/next/server';  // ❌ No longer works

const session = await neonAuth();     // ❌ No longer works
```

**After:**
```typescript

// lib/auth/server.ts - Config once
import { createNeonAuth } from '@neondatabase/auth/next/server';
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
    sessionDataTtl: 300,       // Optional: session data cache TTL in seconds (default: 300 = 5min)
    domain: '.example',        // Optional: for cross-subdomain cookies
  },
});

// app/api/auth/[...path]/route.ts
export const { GET, POST } = auth.handler();

// middleware.ts
export default auth.middleware({ loginUrl: '/auth/sign-in' });

// Server Component - All methods available
const { data: session } = await auth.getSession();
await auth.signIn.email({ email, password });
await auth.signOut();
```

#### 2. Migrating from `neonAuth()` to `auth.getSession()`

**Before:**
```typescript
import { neonAuth } from '@neondatabase/auth/next/server';

const session = await neonAuth();
if (!session.user) {
  // Not logged in
}
```

**After:**
```typescript
import { auth } from '@/lib/auth/server';  // From createNeonAuth()

const { data: session } = await auth.getSession();

if (!session?.user) {
  // Not logged in
}
```

## [0.1.0-beta.21] - 2026-01-14

### Removed

#### Breaking: Server Utilities Removed from `@neondatabase/auth/next`

The following deprecated exports have been removed from `@neondatabase/auth/next`:

- `authApiHandler` - Use `@neondatabase/auth/next/server` instead
- `neonAuthMiddleware` - Use `@neondatabase/auth/next/server` instead
- `neonAuth` - Use `@neondatabase/auth/next/server` instead

**Migration:**

```diff
- import { authApiHandler, neonAuthMiddleware, neonAuth } from '@neondatabase/auth/next';
+ import { authApiHandler, neonAuthMiddleware, neonAuth } from '@neondatabase/auth/next/server';
```

This change enforces proper separation of server-only code (which depends on `next/headers`) from client code.


## [0.1.0-beta.20] - 2025-12-23

### Added

- **Client Telemetry**: Automatically injects `X-Neon-Client-Info` header with SDK name, version, runtime environment (Node.js, Deno, Bun, Edge, Browser), and framework detection (Next.js, Remix, React, Vue, Angular).

## [0.1.0-beta.19] - 2025-12-21

### Fixed

- Session cache now properly updates when user profile is modified via `updateUser`.
- 
## [0.1.0-beta.18] - 2025-12-18

### Fixed

- Fixed import from `@neondatabase/auth/next`.

## [0.1.0-beta.17] - 2025-12-18

### Changed

- Mark server utility exports from `auth/next` in favor of `auth/next/server` to avoid accidental imports in client components.


## [0.1.0-beta.16] - 2025-12-17

### Added

- **Server-Side Auth API (`createAuthServer`)**: New server-side auth client for Next.js backends. Use in Server Actions, Route Handlers, and React Server Components to perform auth operations (sign in, sign out, manage users, organizations) without client-side JavaScript. Export from `@neondatabase/auth/next/server`.

### Changed

- **Server utilities also available from `next/server`**: `neonAuth`, `neonAuthMiddleware`, and `authApiHandler` are now also exported from `@neondatabase/auth/next/server` alongside `createAuthServer`. This provides a clearer separation of server-only code (which depends on `next/headers`) from client code. Both import paths (`next` and `next/server`) remain valid.

## [0.1.0-beta.15] - 2025-12-12

### Added

- **OAuth Popup Flow for Iframes**: Automatic popup-based OAuth flow when running inside iframes. OAuth providers block redirects in iframes due to X-Frame-Options/CSP restrictions - the SDK now detects this and opens OAuth in a popup window instead, communicating the result back via postMessage.

## [0.1.0-beta.14] - 2025-12-11

### Fixed

- **CSS generation**: Fixed CSS generation to include all necessary classes and avoid conflicts with Tailwind CSS v3.


## [0.1.0-beta.13] - 2025-12-10

### Added

- **Anonymous Token Support**: Added `anonymousTokenClient` plugin for fetching anonymous JWT tokens via `/token/anonymous` endpoint. When `allowAnonymous: true` is configured, unauthenticated users receive an anonymous token enabling RLS-based data access with the anonymous role.

## [0.1.0-beta.6] - 2025-12-08

### New exports
- **Type Definitions**: Re-exported all Better Auth plugin types from `@neondatabase/auth/types`

### Changed

- **Phone Number Client**: Removed `phoneNumberClient` plugin from supported plugins
- **Magic Link Client**: Removed `magicLinkClient` plugin from supported plugins


## [0.1.0-beta.1] - 2025-12-07

### Changed

#### Breaking: Package Renamed
- Package renamed from `@neondatabase/neon-auth` to `@neondatabase/auth`
- Update your imports: `@neondatabase/neon-auth` → `@neondatabase/auth`

#### New Export Structure
- Added subpath exports for better tree-shaking and organization:
  - `@neondatabase/auth` - Main exports (createAuthClient, types)
  - `@neondatabase/auth/react` - React adapter exports
  - `@neondatabase/auth/react/ui` - UI components re-exported from auth-ui
  - `@neondatabase/auth/react/ui/server` - Server-side utilities
  - `@neondatabase/auth/react/adapters` - BetterAuthReactAdapter
  - `@neondatabase/auth/vanilla` - Vanilla adapter exports
  - `@neondatabase/auth/vanilla/adapters` - SupabaseAuthAdapter, BetterAuthVanillaAdapter
  - `@neondatabase/auth/next` - Next.js integration (toNextJsHandler, neonAuthMiddleware, createAuthClient)
  - `@neondatabase/auth/ui/css` - Pre-built CSS
  - `@neondatabase/auth/ui/tailwind` - Tailwind CSS

### Added

- **Next.js Integration**: Added `toNextJsHandler`, `neonAuthMiddleware`, and `createAuthClient` for seamless Next.js support
- **Server Entrypoint**: Added `@neondatabase/auth/react/ui/server` for server-side utilities
- **CSS Distribution**: CSS files from auth-ui are now available via `@neondatabase/auth/ui/css` and `@neondatabase/auth/ui/tailwind`

### Fixed

- **ESM Exports**: Fixed `.mjs` exports for proper ESM module resolution
- **Use Client Directives**: Fixed preservation of `'use client'` directives in bundled output
- **Session/User Types**: Removed Supabase-specific type dependencies, now uses Better Auth native types
- **OAuth Middleware**: Fixed URL handling in OAuth callback middleware

### Removed

- **Supabase Type Dependencies**: Removed `Session` and `User` type mappings that mimicked Supabase structure; adapters now use Better Auth native types directly

## [0.1.0-alpha.8] - 2025-12-04

### Fixed

- **Session Cache**: Fixed cache to store Better Auth native format (`{ session, user }`) instead of mapped Supabase format, ensuring consistent data across all adapters
- **Cross-Tab Sync**: Fixed broadcast channel to use stable client ID per tab and filter own broadcasts, preventing duplicate event processing and infinite loops
- **Cache Lifecycle**: Centralized cache management in core hooks (`signIn`, `signUp`, `getSession`, `signOut`) instead of scattered adapter-level caching
- **Force Fetch**: Added `X-Force-Fetch` header support to bypass cache when explicit refresh is needed

### Changed

- **Type Definitions**: Simplified `better-auth-types.ts` to re-export Better Auth's native `Session` and `User` types instead of maintaining duplicate interfaces
- **Broadcast Payload**: Cross-tab broadcasts now use Better Auth native `sessionData` format; adapters map to their specific format (e.g., Supabase) only at API boundaries
- **Cache Read**: `getSession` now uses `beforeRequest` hook to return cached data as a Response, unifying cache behavior across all adapters


## [0.1.0-alpha.7] - 2025-12-03

### Fixed

- **OAuth Flow**: Fixed session verification by sending the `session_verifier` token during OAuth callback, and cleaning it from the URL after successful authentication

## [0.1.0-alpha.6] - 2025-12-03

### Added

- **Anonymous Sign-In**: Implemented `signInAnonymously` method using Better Auth's `anonymousClient` plugin, enabling anonymous authentication flows

### Changed

- **Type Inference**: Improved TypeScript type inference for Better Auth client with properly typed plugins via `SupportedBetterAuthClientPlugins` export
- **Error Handling**: Set `throw: false` in fetch options to ensure consistent error handling across all Better Auth calls

### Temporarily Disabled

- **Organization Client**: Disabled `organizationClient` plugin pending upstream Better Auth fix

## [0.1.0-alpha.2] - 2025-11-27

### Changed

#### Breaking: Factory Function Pattern for Adapters
- Replaced class-based adapter passing with factory functions
- Adapters are now invoked as functions: `SupabaseAuthAdapter()`, `BetterAuthVanillaAdapter()`, `BetterAuthReactAdapter()`
- Factory functions return builder functions that accept the URL internally
- Old: `adapter: SupabaseAuthAdapter` → New: `adapter: SupabaseAuthAdapter()`

#### API Rename
- Renamed `createNeonAuth` to `createAuthClient` for clearer naming

### Removed

- Removed `NeonAuthAdapterClass` type (no longer needed with factory pattern)
- Internal adapter classes are no longer exported (use factory functions instead)

## [0.1.0-alpha.1] - 2025-11-26

### Added

#### Core Interface
- `NeonAuthClientInterface` defining standard authentication interface
- Error types: `AuthError`, `AuthApiError` for consistent error handling
- Full TypeScript support with strict mode enabled

#### Better Auth Adapter
- Complete Better Auth adapter implementation (~1820 lines)
- 25+ authentication methods including:
  - Email/password authentication (`signUp`, `signInWithPassword`)
  - OAuth social login (`signInWithOAuth`) with all Better Auth providers
  - Magic link/OTP authentication (`signInWithOtp`, `verifyOtp`)
  - Session management (`getSession`, `refreshSession`, `setSession`, `signOut`)
  - User management (`getUser`, `updateUser`, `getClaims`)
  - Identity linking (`linkIdentity`, `unlinkIdentity`, `getUserIdentities`)
  - Password reset (`resetPasswordForEmail`, `resend`)
  - OAuth callback handling (`exchangeCodeForSession`)
  - Reauthentication (`reauthenticate`)
  - State change monitoring (`onAuthStateChange`)

#### Performance Optimizations
- Session caching with 60s TTL (or until JWT expires)
- TTL calculation from JWT `exp` claim minus clock skew buffer
- Lazy expiration checked on reads
- Request deduplication for `getSession()` and `getJwtToken()` calls
- 10x faster cold starts (10 concurrent calls: ~2000ms -> ~200ms)

#### Cross-Tab Synchronization
- BroadcastChannel-based cross-tab sync (browser only)
- Token refresh detection via 30s polling interval
- Synchronous cache clearing on sign-out
- Invalidation flag prevents race conditions

#### Event System
- `onAuthStateChange()` monitors: `SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`, `USER_UPDATED`
- Synchronous emission in state-changing methods

#### Environment Support
- Full browser support with cross-tab authentication synchronization
- Node.js support with automatic graceful degradation of browser-only features

#### Testing
- Comprehensive test suite using real Better Auth SDK with MSW for network mocking
- Tests for authentication flows, session management, error handling
- OAuth flows testing for both Node.js and browser environments

