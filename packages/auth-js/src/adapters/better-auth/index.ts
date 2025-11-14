// Public adapter class
export { BetterAuthAdapter } from './better-auth-adapter';

// Public types
export type {
  BetterAuthClient,
  BetterAuthSession,
  BetterAuthUser,
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

// Internal utilities (for testing and advanced use cases)
export { InFlightRequestManager } from './in-flight-request-manager';
