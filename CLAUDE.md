# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A unified TypeScript SDK monorepo for Neon services, providing seamless integration with **Neon Auth** (authentication service) and **Neon Data API** (PostgreSQL database queries). Built with a familiar interface for easy adoption.

## Monorepo Structure

This is a Bun workspaces monorepo with four published packages:

### `@neondatabase/postgrest-js` (packages/postgrest-js/)
Generic PostgreSQL client for Neon Data API without authentication:
- **NeonPostgrestClient**: Wrapper around the upstream PostgrestClient with Neon-specific configuration
- **fetchWithToken()**: Generic utility for adding token-based authentication to requests
- No auth dependencies - can be used standalone for non-authenticated scenarios

**Exports:**
- `@neondatabase/postgrest-js` - Main exports (NeonPostgrestClient, fetchWithToken, AuthRequiredError)

### `@neondatabase/auth` (packages/auth/)
Authentication adapters for Neon Auth supporting multiple auth providers:
- **createAuthClient()**: Factory function for creating auth clients with configurable adapters
- **SupabaseAuthAdapter**: Supabase-compatible API for familiar auth patterns
- **BetterAuthVanillaAdapter**: Direct Better Auth API for vanilla JS/TS
- **BetterAuthReactAdapter**: Better Auth with React hooks support
- **Next.js Integration**: Handler, middleware, and client factory for Next.js apps

**Exports:**
- `@neondatabase/auth` - Main exports (createAuthClient, types)
- `@neondatabase/auth/react` - React adapter exports
- `@neondatabase/auth/react/ui` - Re-exports from auth-ui
- `@neondatabase/auth/react/ui/server` - Server-side utilities
- `@neondatabase/auth/react/adapters` - BetterAuthReactAdapter
- `@neondatabase/auth/vanilla` - Vanilla adapter exports
- `@neondatabase/auth/vanilla/adapters` - SupabaseAuthAdapter, BetterAuthVanillaAdapter
- `@neondatabase/auth/next` - Next.js integration (toNextJsHandler, neonAuthMiddleware, createAuthClient)
- `@neondatabase/auth/types` - Better Auth types (Session, User, Organization, etc.)
- `@neondatabase/auth/ui/css` - Pre-built CSS
- `@neondatabase/auth/ui/tailwind` - Tailwind CSS

### `@neondatabase/neon-js` (packages/neon-js/)
Main SDK package that combines authentication with PostgreSQL querying:
- **NeonClient**: Auth-integrated client extending NeonPostgrestClient
- **createClient()**: Factory function that accepts any auth adapter
- **CLI Tool**: Database type generation utility
- Re-exports all neon-auth exports for convenience

**Exports:**
- `@neondatabase/neon-js` - Main exports (createClient, SupabaseAuthAdapter, BetterAuthVanillaAdapter, utilities)
- `@neondatabase/neon-js/cli` - CLI tool
- `@neondatabase/neon-js/auth` - Re-exports @neondatabase/auth
- `@neondatabase/neon-js/auth/types` - Re-exports @neondatabase/auth/types
- `@neondatabase/neon-js/auth/react` - Re-exports @neondatabase/auth/react
- `@neondatabase/neon-js/auth/react/ui` - Re-exports @neondatabase/auth/react/ui
- `@neondatabase/neon-js/auth/react/ui/server` - Re-exports @neondatabase/auth/react/ui/server
- `@neondatabase/neon-js/auth/react/adapters` - Re-exports @neondatabase/auth/react/adapters (BetterAuthReactAdapter)
- `@neondatabase/neon-js/auth/vanilla` - Re-exports @neondatabase/auth/vanilla
- `@neondatabase/neon-js/auth/vanilla/adapters` - Re-exports @neondatabase/auth/vanilla/adapters
- `@neondatabase/neon-js/auth/next` - Re-exports @neondatabase/auth/next
- `@neondatabase/neon-js/ui/css` - Pre-built CSS
- `@neondatabase/neon-js/ui/tailwind` - Tailwind CSS

**Dependencies:**
```
@neondatabase/neon-js
    ├── @neondatabase/auth
    └── @neondatabase/postgrest-js
```

### `@neondatabase/auth-ui` (packages/auth-ui/)
UI components for Neon Auth built on top of [better-auth-ui](https://better-auth-ui.com):
- **NeonAuthUIProvider**: React context provider for auth components
- **SignInForm, SignUpForm, UserButton**: Pre-built auth UI components
- **CSS Exports**: Pre-built CSS bundle or Tailwind-ready import

**Exports:**
- `@neondatabase/auth-ui` - Main exports (NeonAuthUIProvider, all better-auth-ui components)
- `@neondatabase/auth-ui/css` - Pre-built CSS bundle
- `@neondatabase/auth-ui/tailwind` - Tailwind-ready CSS
- `@neondatabase/auth-ui/server` - Server-side utilities

**Note:** CSS is also re-exported from `@neondatabase/auth/ui/css` and `@neondatabase/auth/ui/tailwind` for convenience.

**Dependencies:**
- `@neondatabase/auth` (peer dependency)
- `react`, `react-dom` (peer dependencies)
- `@daveyplate/better-auth-ui` (component library)

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
bun run --filter '@neondatabase/auth' build

# Run tests
bun test              # Run all tests
bun test:node         # Node.js runtime (recommended for MSW)
bun test:ci           # CI mode (no watch)

# Type checking
bun typecheck

# Publishing
bun release           # Bump version and publish all packages

# Release individual packages
bun release:postgrest-js
bun release:auth
bun release:auth-ui
bun release:neon-js
```

## Build Configuration

All packages use [tsdown](https://tsdown.dev/) (Rolldown-powered bundler) with a shared base configuration.

### Shared Config Helper

Common settings are centralized in `build/tsdown-base.ts`:

```typescript
import { createPackageConfig } from '../../build/tsdown-base.ts';

export default defineConfig(
  createPackageConfig({
    entry: ['src/index.ts'],
    // Package-specific overrides...
  })
);
```

**Shared defaults:**
- `format: ['esm']` - ESM-only output (modern standard)
- `dts: { build: true }` - TypeScript declarations
- `clean: true` - Clean dist before build (can be overridden)

### Shared Plugins

**`build/preserve-directives.ts`** - Preserves React `'use client'` and `'use server'` directives through bundling. Used by React packages (auth-ui, auth, neon-js).

### CSS Build Chain

CSS flows through packages in dependency order (handled by Bun's topological sort):

```
auth-ui (generates CSS via TailwindCSS CLI)
   ↓
auth (copies CSS from auth-ui/dist)
   ↓
neon-js (copies CSS from auth/dist)
```

### Adding a New Package

1. Create `packages/<name>/tsdown.config.ts`:
```typescript
import { defineConfig } from 'tsdown';
import { createPackageConfig } from '../../build/tsdown-base.ts';

export default defineConfig(
  createPackageConfig({
    entry: ['src/index.ts'],
    // Add external workspace deps if needed:
    // external: ['@neondatabase/auth'],
  })
);
```

2. For React packages with client components, add the directive plugin:
```typescript
import { preserveDirectives } from '../../build/preserve-directives.ts';

export default defineConfig(
  createPackageConfig({
    entry: ['src/index.ts'],
    plugins: [preserveDirectives()],
  })
);
```

## Build Artifacts & Design Decisions

### Side-Effect Imports in Bundle Output

You may notice `import "@neondatabase/auth/react/adapters"` in `packages/neon-js/dist/index.mjs`.
This is a **bundler artifact from type-only imports**, NOT actual React code being bundled.

- **Source:** Type import for function overloads in `client-factory.ts`
- **Impact:** Zero runtime bytes - the import is externalized
- **Verification:** Main bundle is 1.48KB with no React code

The `external` config correctly externalizes `@neondatabase/auth`, and tsdown extends this to all subpaths. The import statement tells bundlers "this is an external dependency" - it does not include the code.

### CSS Build Chain & Distribution

CSS is intentionally duplicated across packages for convenience imports:

```
auth-ui (generates via Tailwind) → auth (copies) → neon-js (copies)
```

**Why triplication?** Enables users to import CSS from whichever package they use:
- `@neondatabase/auth-ui/css` - Direct from source
- `@neondatabase/auth/ui/css` - Convenience for auth-only users
- `@neondatabase/neon-js/ui/css` - Convenience for full SDK users

**End-user impact:** Minimal. npm deduplicates identical files during download. End users get ~47KB of CSS, not 141KB.

### Re-export File Structure

The 8 re-export files in `packages/neon-js/src/auth/` are **mandatory**, not optional complexity.

**Why they exist:** npm's `exports` field cannot reference external packages. Only relative
paths within the package are valid (per Node.js ESM specification). Wrapper files are the only way to provide the unified
`@neondatabase/neon-js/auth/*` import paths.

**Reference:** [Node.js Packages Documentation](https://nodejs.org/api/packages.html)

## Architecture

### PostgreSQL Client Layer (`packages/postgrest-js/`)

**Client**: `src/client/`
- `postgrest-client.ts` - NeonPostgrestClient class (extends the upstream PostgrestClient)
- `fetch-with-token.ts` - Generic token-based fetch wrapper
- `index.ts` - Client exports

**No Dependencies on Auth**: This package is completely independent and can be used for scenarios where authentication is handled externally or not required.

### Authentication Layer (`packages/auth/`)

**Factory**: `src/neon-auth.ts`
- `createAuthClient()` - Public factory for creating auth clients
- `createInternalNeonAuth()` - Internal factory for NeonClient integration
- Type definitions for `NeonAuthAdapter`, `NeonAuthAdapterClass`

**Adapters**: `src/adapters/`
- **Supabase Adapter**: `adapters/supabase/`
  - `supabase-adapter.ts` - Supabase-compatible API implementation
  - `auth-interface.ts` - AuthError, AuthApiError types
  - `errors/` - Error definitions and mappings
  - `better-auth-docs.md` - Adapter documentation
  - `better-auth-plugins.md` - Plugin configuration

- **Better Auth Vanilla**: `adapters/better-auth-vanilla/`
  - `better-auth-vanilla-adapter.ts` - Direct Better Auth API

- **Better Auth React**: `adapters/better-auth-react/`
  - `better-auth-react-adapter.ts` - Better Auth with React hooks (`useSession`)

**Core**: `src/core/`
- `adapter-core.ts` - Base adapter class with shared functionality
- `session-cache-manager.ts` - Session caching with TTL
- `in-flight-request-manager.ts` - Request deduplication
- `better-auth-helpers.ts` - Session mapping and error handling
- `better-auth-types.ts` - Type definitions
- `better-auth-methods.ts` - Shared method implementations
- `constants.ts` - Configuration (TTLs, intervals, buffers)

**Utilities**: `src/utils/`
- `jwt.ts` - JWT parsing and expiration utilities
- `date.ts` - Date utilities
- `browser.ts` - Browser detection utilities

**Tests**: `src/__tests__/`
- Uses real Better Auth SDK with MSW for network mocking
- Run with `bun test:node` for reliable MSW interception

### Auth-Integrated Client Layer (`packages/neon-js/`)

**Client**: `src/client/`
- `neon-client.ts` - NeonClient class (extends NeonPostgrestClient, adds required auth)
- `client-factory.ts` - `createClient()` factory with adapter configuration
- `fetch-with-auth.ts` - Auth-aware fetch wrapper
- `index.ts` - Client exports

**CLI Tool**: `src/cli/`
- `index.ts` - CLI entry point (bin: `neon-js`)
- `commands/gen-types.ts` - Type generation command
- `commands/generate-types.ts` - Core logic using postgres-meta
- `utils/parse-duration.ts` - Duration parsing

**Dependencies**: Imports from `@neondatabase/postgrest-js` and `@neondatabase/auth`

**Next.js Integration** (in `packages/auth/src/next/`):
- `handler/` - `toNextJsHandler()` for API routes
- `middleware/` - `neonAuthMiddleware()` for route protection
- `index.ts` - `createAuthClient()` pre-configured for Next.js

### UI Components Layer (`packages/auth-ui/`)

**Provider**: `src/neon-auth-ui-provider.tsx`
- `NeonAuthUIProvider` - React context provider for auth UI components
- Wraps better-auth-ui's AuthUIProvider

**Adapter**: `src/react-adapter.ts`
- Converts neon-auth client to better-auth-ui compatible format
- Handles session caching and auth state

**Exports**: `src/index.ts`
- Re-exports all `@daveyplate/better-auth-ui` components
- `NeonAuthUIProvider`, `useNeonAuth` hooks

**CSS**: `src/`
- `theme.css` - CSS custom properties for theming
- `tailwind.css` - Tailwind-ready CSS import
- `index.css` - Entry point

**Server**: `src/server.ts`
- Server-side utilities for auth

## Usage

### Using PostgrestClient (No Auth)

For scenarios where authentication is handled externally or not required:

```typescript
import { NeonPostgrestClient, fetchWithToken } from '@neondatabase/postgrest-js';

// Option 1: Basic usage without authentication
const client = new NeonPostgrestClient({
  dataApiUrl: 'https://your-data-api.com/rest/v1',
  options: {
    global: {
      headers: { 'Authorization': 'Bearer YOUR_TOKEN' },
    },
  },
});

// Option 2: With custom token provider
const client = new NeonPostgrestClient({
  dataApiUrl: 'https://your-data-api.com/rest/v1',
  options: {
    global: {
      fetch: fetchWithToken(async () => 'YOUR_TOKEN'),
    },
  },
});

// Query database
const { data: items } = await client.from('items').select();
```

### Using NeonClient (With Auth) - Adapter Pattern

The `createClient()` factory accepts any auth adapter, allowing you to choose the API style:

#### SupabaseAuthAdapter (Supabase-compatible API)

```typescript
import { createClient, SupabaseAuthAdapter } from '@neondatabase/neon-js';

const client = createClient<Database>({
  auth: {
    adapter: SupabaseAuthAdapter,
    url: 'https://auth.example.com',
  },
  dataApi: {
    url: 'https://data-api.example.com/rest/v1',
  },
});

// Supabase-compatible auth methods
await client.auth.signInWithPassword({ email, password });
const { data: session } = await client.auth.getSession();
await client.auth.signOut();

// Database queries (automatic token injection)
const { data: items } = await client.from('items').select();
```

#### BetterAuthVanillaAdapter (Direct Better Auth API)

```typescript
import { createClient, BetterAuthVanillaAdapter } from '@neondatabase/neon-js';

const client = createClient<Database>({
  auth: {
    adapter: BetterAuthVanillaAdapter,
    url: 'https://auth.example.com',
  },
  dataApi: {
    url: 'https://data-api.example.com/rest/v1',
  },
});

// Direct Better Auth API
await client.auth.signIn.email({ email, password });
const session = await client.auth.getSession();
await client.auth.signOut();

// Database queries (automatic token injection)
const { data: items } = await client.from('items').select();
```

#### BetterAuthReactAdapter (With React Hooks)

```typescript
import { createClient } from '@neondatabase/neon-js';
import { BetterAuthReactAdapter } from '@neondatabase/neon-js/auth/react/adapters';

const client = createClient<Database>({
  auth: {
    adapter: BetterAuthReactAdapter,
    url: 'https://auth.example.com',
  },
  dataApi: {
    url: 'https://data-api.example.com/rest/v1',
  },
});

// React hooks available
function MyComponent() {
  const session = client.auth.useSession();

  if (session.isPending) return <div>Loading...</div>;
  if (!session.data) return <div>Not logged in</div>;

  return <div>Hello, {session.data.user.name}</div>;
}
```

### Using Auth Adapters Directly

```typescript
import { createAuthClient, SupabaseAuthAdapter } from '@neondatabase/auth';

const auth = createAuthClient('https://your-auth-server.com', {
  adapter: SupabaseAuthAdapter,
});

await auth.signInWithPassword({ email, password });
const { data: session } = await auth.getSession();
```

### Using with Next.js

```typescript
// api/auth/[...path]/route.ts
import { toNextJsHandler } from "@neondatabase/auth/next"

export const { GET, POST } = toNextJsHandler(
  process.env.NEON_AUTH_BASE_URL
)

// lib/auth/client.ts
"use client"
import { createAuthClient } from '@neondatabase/auth/next';
export const authClient = createAuthClient()

// middleware.ts
import { neonAuthMiddleware } from '@neondatabase/auth/next';
export default neonAuthMiddleware();
```

### Using Auth UI Components

```typescript
// app/provider.tsx
'use client';
import { NeonAuthUIProvider } from '@neondatabase/auth-ui';
import { authClient } from '@/lib/client';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <NeonAuthUIProvider authClient={authClient} redirectTo="/dashboard">
      {children}
    </NeonAuthUIProvider>
  );
}

// app/auth/page.tsx
import { SignInForm, SignUpForm } from '@neondatabase/auth-ui';

export default function AuthPage() {
  return <SignInForm />;
}
```

**CSS Import Options:**
```css
/* Without Tailwind - import pre-built CSS */
@import '@neondatabase/auth/ui/css';

/* With Tailwind CSS v4 */
@import 'tailwindcss';
@import '@neondatabase/auth/ui/tailwind';
```

## Adapter Features

### Session Caching
- In-memory cache with 60s TTL (or until JWT expires)
- TTL calculated from JWT `exp` claim minus clock skew buffer
- Lazy expiration checked on reads
- Synchronous cache clearing on sign-out
- Invalidation flag prevents race conditions

### Request Deduplication
- Multiple concurrent `getSession()`/`getJwtToken()` calls deduplicate to single request
- 10x faster cold starts (10 concurrent calls: ~2000ms -> ~200ms)
- Reduces server load by N-1 for N concurrent calls
- Implemented via generic `InFlightRequestManager`

### Event System (SupabaseAuthAdapter)
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
- Verifies API compatibility and interface contracts
- Catches breaking changes in Better Auth SDK versions
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
// Absolute imports using workspace protocol
// Package naming: @neondatabase/package-name
```

## Key Mappings (SupabaseAuthAdapter)

Following the [Better Auth Supabase Migration Guide](https://www.better-auth.com/docs/guides/supabase-migration-guide):

**Authentication:**
- `signUp` -> `betterAuth.signUp.email()`
- `signInWithPassword` -> `betterAuth.signIn.email()`
- `signInWithOAuth` -> `betterAuth.signIn.social()`
- `signInWithOtp` -> `betterAuth.signIn.email()` (magic link)
- `signOut` -> `betterAuth.signOut()`

**Session Management:**
- `getSession` -> `betterAuth.getSession()`
- `getUser` -> `betterAuth.getSession()` (extract user)

**User Management:**
- `updateUser` -> `betterAuth.user.update()`
- `getUserIdentities` -> `betterAuth.account.list()`
- `linkIdentity` -> `betterAuth.linkSocial()`
- `unlinkIdentity` -> `betterAuth.account.unlink()`

**Password Management:**
- `resetPasswordForEmail` -> `betterAuth.forgetPassword()`

## Additional Documentation

- `packages/auth/src/adapters/supabase/better-auth-docs.md` - Comprehensive adapter docs
- `packages/auth/src/adapters/supabase/better-auth-plugins.md` - Plugin configuration
- `packages/auth/NEXT-JS.md` - Next.js integration guide
- `packages/auth-ui/README.md` - UI components documentation

## References

- [Better Auth Docs](https://www.better-auth.com/docs)
- [Better Auth Supabase Migration Guide](https://www.better-auth.com/docs/guides/supabase-migration-guide)
- [Supabase Auth Client](https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/SupabaseAuthClient.ts)
- [PostgrestClient](https://github.com/supabase/postgrest-js)
