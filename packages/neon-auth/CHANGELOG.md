# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[unreleased]: https://github.com/neondatabase-labs/neon-js/compare/v0.1.0-alpha.2...HEAD
[0.1.0-alpha.2]: https://github.com/neondatabase-labs/neon-js/compare/v0.1.0-alpha.1...v0.1.0-alpha.2
[0.1.0-alpha.1]: https://github.com/neondatabase-labs/neon-js/releases/tag/v0.1.0-alpha.1
