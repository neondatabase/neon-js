import type { createAuthClient as createReactAuthClient } from 'better-auth/react';
import type { createAuthClient as createVanillaAuthClient } from 'better-auth/client';

// Main interface
export { AuthError, AuthApiError, isAuthError } from './auth-interface';
export type { AuthClient } from './auth-interface';

// Supabase types re-exports
export type { Session, User } from '@supabase/auth-js';

// Adapters
export { BetterAuthAdapter as NeonAuthClient } from './adapters/better-auth';
export type { NeonBetterAuthOptions as NeonAuthClientOptions } from './adapters/better-auth';

// Storage utilities
export {
  BETTER_AUTH_TOKEN_STORAGE,
  createTokenStorage,
  STORAGE_PREFIX,
  STORAGE_KEYS,
} from './utils/storage';
export type { TokenStorage, TokenMetadata } from './utils/storage';

// JWT utilities
export { getJwtExpiration, getJwtExpirationMs } from './utils/jwt';

export type ReactBetterAuthClient = ReturnType<typeof createReactAuthClient>;
export type VanillaBetterAuthClient = ReturnType<
  typeof createVanillaAuthClient
>;
export { useStore as useBetterAuthStore } from 'better-auth/react';
