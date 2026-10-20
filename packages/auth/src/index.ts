// NeonAuth factory and types
export { createInternalNeonAuth, createAuthClient } from './neon-auth';
export type {
  NeonAuth,
  NeonAuthAdapter,
  NeonAuthConfig,
  NeonAuthPublicApi,
} from './neon-auth';

export { type VanillaBetterAuthClient, type ReactBetterAuthClient } from './types';

// Auth error classes + type guards. Documented in llms.txt as the public
// surface for `instanceof AuthApiError` / `instanceof AuthError` narrowing.
export {
  AuthError,
  AuthApiError,
  isAuthError,
  isAuthApiError,
} from './adapters/supabase/auth-interface';

// Exact better-auth version pinned by this package; sent to the Neon Auth
// server in X-Neon-Client-Info so it can pick the matching API shape.
export { BETTER_AUTH_VERSION } from './utils/better-auth-version';
