export { NeonClient } from './neon-client';
export { createClient } from './client-factory';

// Re-export utilities from postgrest-js for convenience
export { fetchWithToken, AuthRequiredError } from '@neondatabase/postgrest-js';

// Re-export auth adapters and utilities from neon-auth for convenience
export {
  createNeonAuth,
  SupabaseAdapter,
  BetterAuthVanillaAdapter,
  BetterAuthReactAdapter,
  type NeonAuth,
  type NeonAuthAdapter,
  type NeonAuthAdapterClass,
  type NeonAuthConfig,
  type SupabaseAdapterOptions,
} from '@neondatabase/neon-auth';
