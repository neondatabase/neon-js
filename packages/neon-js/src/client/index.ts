export { NeonClient } from './neon-client';
export { createClient } from './client-factory';

// Re-export utilities from postgrest-js for convenience
export { fetchWithToken, AuthRequiredError } from '@neondatabase/postgrest-js';

// Re-export auth adapters and utilities from neon-auth for convenience
export {
  createAuthClient,
  // Adapter factory functions
  SupabaseAuthAdapter,
  BetterAuthVanillaAdapter,
  BetterAuthReactAdapter,
  // Types
  type NeonAuth,
  type NeonAuthAdapter,
  // Adapter instance types (for type annotations)
  type SupabaseAuthAdapterInstance,
  type SupabaseAuthAdapterOptions,
  type BetterAuthVanillaAdapterInstance,
  type BetterAuthVanillaAdapterOptions,
  type BetterAuthReactAdapterInstance,
  type BetterAuthReactAdapterOptions,
} from '@neondatabase/neon-auth';
