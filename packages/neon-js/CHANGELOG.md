# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [Unreleased]

### Added

- **Client Telemetry**: Automatically injects `X-Neon-Client-Info` header with SDK name, version, runtime environment (Node.js, Deno, Bun, Edge, Browser), and framework detection (Next.js, Remix, React, Vue, Angular).

## [0.1.0-beta.18] - 2025-12-18

### Fixed

- Added missing `@neondatabase/neon-js/auth/next/server` export for server-side auth operations (createAuthServer)

## [0.1.0-alpha.9] - 2025-12-03

### Changed

- Bump @neondatabase/auth to 0.1.0-alpha.6


## [0.1.0-alpha.8] - 2025-12-03

### Changed

- Bump @neondatabase/auth to 0.1.0-alpha.5

## [0.1.0-alpha.7] - 2025-12-03

### Changed

- Bump @neondatabase/auth to 0.1.0-alpha.4

## [0.1.0-alpha.6] - 2025-11-27

### Changed

- Bump @neondatabase/auth to 0.1.0-alpha.3

## [0.1.0-alpha.5] - 2025-11-27

### Changed

- Bump @neondatabase/auth to 0.1.0-alpha.2

## [0.1.0-alpha.4] - 2025-11-26

### Internal
- update neon-auth dependency

## [0.1.0-alpha.3] - 2025-11-26

### Internal
- update neon-auth dependency

## [0.1.0-alpha.2] - 2025-11-26

### Added

#### New Architecture
- Explicit URL configuration with separate `auth.url` and `dataApi.url`
- Updated `createClient()` factory with flexible URL configuration
- Type-safe client factory with proper generics
- Comprehensive type tests in `src/__tests__/type-tests.ts`
- New client exports in `src/client/index.ts`

### Changed

- Renamed dependency from `@neondatabase/auth-js` to `@neondatabase/auth`
- Updated `NeonClient` to work with new auth adapter architecture
- Improved `client-factory.ts` with better type inference
- Updated documentation with dual URL mode examples

## [0.1.0-alpha.1] - 2025-10-24

### Added

#### Core SDK
- Unified TypeScript SDK for Neon Auth and Neon Data API
- `NeonClient` class extending PostgrestClient for seamless database queries
- `createClient()` factory function for easy client initialization
- Automatic token injection via auth-aware fetch wrapper
- Full TypeScript support with strict mode enabled
- Support for custom headers, fetch implementation, and schema configuration

#### Authentication
- Complete Supabase-compatible `AuthClient` interface for easy migration
- Better Auth adapter with 25+ authentication methods:
  - Email/password authentication (`signUp`, `signInWithPassword`)
  - OAuth social login (`signInWithOAuth`) with all Better Auth providers
  - Magic link/OTP authentication (`signInWithOtp`, `verifyOtp`)
  - Session management (`getSession`, `refreshSession`, `setSession`, `signOut`)
  - User management (`getUser`, `updateUser`, `getClaims`)
  - Identity linking (`linkIdentity`, `unlinkIdentity`, `getUserIdentities`)
  - Password reset (`resetPasswordForEmail`, `resend`)
  - OAuth callback handling (`exchangeCodeForSession`)
  - Re-authentication (`reauthenticate`)
  - State change monitoring (`onAuthStateChange`)
- Session caching optimization with TTL-based expiration (<5ms cached reads)
- JWT token validation with Zod schemas
- Comprehensive error handling with detailed error messages

#### Environment Support
- Full browser support with cross-tab authentication synchronization via BroadcastChannel
- Node.js support with automatic graceful degradation of browser-only features
- Server-side support with secret key authentication
- Memory and cookie-based token storage options

#### CLI Tool
- `neon-js` command-line tool for TypeScript type generation
- Database schema introspection using Supabase's postgres-meta
- Multi-schema support
- PostgREST v9 compatibility mode
- Configurable query timeouts
- Custom output path support

#### Testing Infrastructure
- Comprehensive test suite with 10+ test files covering:
  - Authentication flows
  - Session management
  - Error handling
  - OAuth flows (Node.js and browser environments)
  - OTP/magic link authentication
  - User management
  - Supabase API compatibility
- MSW (Mock Service Worker) for HTTP mocking
- Vitest test framework with Node.js and Bun runtime support
- Test utilities and shared fixtures

#### Documentation
- Comprehensive README with quick start guide
- Real-world migration example (Todo Guardian Pro)
- Supabase migration guide
- API reference for all authentication methods
- Architecture documentation
- Performance benchmarks

[unreleased]: https://github.com/neondatabase/neon-js/compare/v0.1.0-alpha.1...HEAD
[0.1.0-alpha.1]: https://github.com/neondatabase/neon-js/releases/tag/v0.1.0-alpha.1
