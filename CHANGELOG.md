# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- Stack Auth adapter with 25+ authentication methods:
  - Email/password authentication (`signUp`, `signInWithPassword`)
  - OAuth social login (`signInWithOAuth`) with all Stack Auth providers
  - Magic link/OTP authentication (`signInWithOtp`, `verifyOtp`)
  - Session management (`getSession`, `refreshSession`, `setSession`, `signOut`)
  - User management (`getUser`, `updateUser`, `getClaims`)
  - Identity linking (`linkIdentity`, `unlinkIdentity`, `getUserIdentities`)
  - Password reset (`resetPasswordForEmail`, `resend`)
  - OAuth callback handling (`exchangeCodeForSession`)
  - Reauthentication (`reauthenticate`)
  - State change monitoring (`onAuthStateChange`)
- Session caching optimization leveraging Stack Auth internals (<5ms cached reads)
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
- Stack Auth vs Supabase feature comparison

### Known Limitations

The following authentication methods are not supported by Stack Auth and return detailed error messages:
- `signInWithIdToken()` - Stack Auth uses OAuth redirect flows only
- `signInWithSSO()` - SAML SSO not supported (OAuth social providers only)
- `signInWithWeb3()` - Blockchain/crypto wallet authentication not supported
- `signInAnonymously()` - Anonymous authentication not supported

Password updates via `updateUser({ password })` require old password or password reset flow due to Stack Auth security requirements.

[unreleased]: https://github.com/neondatabase-labs/neon-js/compare/v0.1.0-alpha.1...HEAD
[0.1.0-alpha.1]: https://github.com/neondatabase-labs/neon-js/releases/tag/v0.1.0-alpha.1
