# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a TypeScript SDK that provides a unified authentication interface based on Supabase's auth API. The project uses an adapter pattern to support multiple authentication providers while maintaining a consistent API.

## Architecture
- **Core Interface**: `src/auth/auth-interface.ts` defines the `AuthClient` interface based on Supabase's AuthClient
- **Adapter Pattern**: Authentication providers implement the `AuthClient` interface
- **Adapters**: Located in `src/auth/adapters/`
  - `stack-auth.ts` - Stack Auth provider adapter (in development)
- **Entry Point**: `src/index.ts` exports the interface types and adapters
- **Build Output**: Compiled to `dist/` directory

## Development Commands
- `bun dev` - Start development server with watch mode
- `bun build` - Build the project for production
- `bun test` - Run unit tests with vitest
- `bun typecheck` - Run TypeScript type checking
- `bun release` - Bump version and publish to npm

## Code Style
- TypeScript strict mode enabled
- Use functional patterns where possible
- AVOID the "I" prefix in interface names
- Always use absolute imports following the `@/` pattern

## Stack Auth Session Caching

The Stack Auth adapter optimizes session retrieval by leveraging Stack Auth's built-in tokenStore and internal session caching:

### How It Works:
1. **First `getSession()` call**: Reads from Stack Auth's internal session cache or tokenStore (localStorage/cookies)
2. **Subsequent calls**: Returns in-memory cached session (no network/storage access)
3. **Token refresh**: Automatically refreshes tokens 90 seconds before expiration
4. **Persistence**: Sessions persist across page reloads via tokenStore

### Token Handling:
Stack Auth's `getTokens()` returns objects with a `token` property:
```typescript
{
  accessToken: { token: "eyJ..." },
  refreshToken: { token: "d37..." }
}
```
The adapter extracts these token strings for session management and JWT decoding.

### tokenStore Configuration:
```typescript
import { StackAuthAdapter } from '@/auth/adapters/stack-auth';

// Browser: Use cookie storage (recommended for SSR)
const adapter = new StackAuthAdapter({
  projectId: 'your-project-id',
  publishableClientKey: 'pk_...',
  tokenStore: 'cookie',
});

// Browser: Use memory storage (lost on reload)
const adapter = new StackAuthAdapter({
  projectId: 'your-project-id',
  publishableClientKey: 'pk_...',
  tokenStore: 'memory',
});
```

### Performance Characteristics:
- **Cached `getSession()`**: <5ms (no network/storage I/O)
- **First `getSession()` after reload**: <50ms (reads from tokenStore)
- **Token refresh**: <200ms (network call to Stack Auth)

## Testing
- Test framework: Vitest
- Tests located in `tests/` directory
- Run tests with `bun test`


## Supabase references

- [SupabaseAuthClient.ts](https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/SupabaseAuthClient.ts) - Main implementation
- [SupabaseClient.ts](https://github.com/supabase/supabase-js/blob/master/packages/core/supabase-js/src/SupabaseClient.ts) - Main implementation