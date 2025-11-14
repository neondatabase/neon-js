// Public adapter class
export { BetterAuthAdapter } from './better-auth-adapter';

// Public types
export type {
  BetterAuthClient,
  BetterAuthSession,
  BetterAuthUser,
  OnAuthStateChangeConfig,
  NeonBetterAuthOptions,
} from './better-auth-types';

// Re-export BetterAuthClientOptions from better-auth
export type { BetterAuthClientOptions } from 'better-auth/client';

// Public helpers (if needed externally)
export {
  mapBetterAuthSessionToSupabase,
  mapBetterAuthUserToSupabase,
} from './better-auth-helpers';

// Constants (for advanced configuration)
export * from './constants';

// Session validation schema (for testing and advanced use cases)
export { sessionSchema } from './storage-schemas';

// Internal utilities (for testing and advanced use cases)
export { InFlightRequestManager } from './in-flight-request-manager';
