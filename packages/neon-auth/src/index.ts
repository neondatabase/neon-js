// NeonAuth factory and types
export {
  createInternalNeonAuth,
  createAuthClient,
  type NeonAuth,
  type NeonAuthAdapter,
  type NeonAuthConfig,
  type NeonAuthPublicApi,
  type ReactBetterAuthClient,
  type VanillaBetterAuthClient,
} from './neon-auth';

// Main interface
export {
  AuthError,
  AuthApiError,
  isAuthError,
} from './adapters/supabase/auth-interface';

// Auth types re-exports
export type { Session, User } from '@supabase/auth-js';

// Adapter factory functions
export { BetterAuthVanillaAdapter } from './adapters/better-auth-vanilla/better-auth-vanilla-adapter';
export { BetterAuthReactAdapter } from './adapters/better-auth-react/better-auth-react-adapter';
export { SupabaseAuthAdapter } from './adapters/supabase/supabase-adapter';

// Adapter instance types (for type annotations)
export type {
  BetterAuthVanillaAdapterInstance,
  BetterAuthVanillaAdapterOptions,
} from './adapters/better-auth-vanilla/better-auth-vanilla-adapter';
export type {
  BetterAuthReactAdapterInstance,
  BetterAuthReactAdapterOptions,
} from './adapters/better-auth-react/better-auth-react-adapter';
export type {
  SupabaseAuthAdapterInstance,
  SupabaseAuthAdapterOptions,
} from './adapters/supabase/supabase-adapter';

// JWT utilities
export { getJwtExpiration, getJwtExpirationMs } from './utils/jwt';

// Better Auth React hooks
export { useStore as useBetterAuthStore } from 'better-auth/react';
