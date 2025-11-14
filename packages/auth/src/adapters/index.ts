// Better Auth adapter (primary)
export {
  BetterAuthAdapter,
  InFlightRequestManager,
  mapBetterAuthSessionToSupabase,
  mapBetterAuthUserToSupabase,
  SESSION_CACHE_TTL_MS,
  CLOCK_SKEW_BUFFER_MS,
  BROADCAST_CHANNEL_NAME,
} from './better-auth';
export type {
  BetterAuthClient,
  BetterAuthSession,
  BetterAuthUser,
  BetterAuthClientOptions,
  OnAuthStateChangeConfig as BetterAuthOnAuthStateChangeConfig,
  NeonBetterAuthOptions,
} from './better-auth';

// Stack Auth adapter (legacy)
export { StackAuthAdapter } from './stack-auth';
export type {
  OnAuthStateChangeConfig as StackAuthOnAuthStateChangeConfig,
} from './stack-auth';
