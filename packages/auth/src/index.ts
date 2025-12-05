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

// Error types
export {
  AuthError,
  AuthApiError,
  isAuthError,
} from './adapters/supabase/auth-interface';

// Auth types re-exports
export type { Session, User } from '@supabase/auth-js';

// JWT utilities
export { getJwtExpiration, getJwtExpirationMs } from './utils/jwt';
