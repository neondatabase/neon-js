// Main client factory
export { createClient } from './client/client-factory';
export type { CreateClientStringOptions } from './client/client-factory';

// URL derivation (mostly used by wrappers; end users don't need this)
export {
  defaultDeriveNeonUrls,
  type DeriveNeonUrls,
} from './client/derive-urls';

// Re-export utilities from postgrest-js for convenience
export { fetchWithToken, AuthRequiredError } from '@neondatabase/postgrest-js';

// Re-export auth utilities (no React dependency)
export {
  type NeonAuth,
  type NeonAuthAdapter,
  type NeonAuthConfig,
  type NeonAuthPublicApi,
  type ReactBetterAuthClient,
  type VanillaBetterAuthClient,
} from '@neondatabase/auth';

// Re-export vanilla adapters (no React dependency)
export {
  SupabaseAuthAdapter,
  BetterAuthVanillaAdapter,
  type SupabaseAuthAdapterInstance,
  type SupabaseAuthAdapterOptions,
  type BetterAuthVanillaAdapterInstance,
  type BetterAuthVanillaAdapterOptions,
} from '@neondatabase/auth/vanilla/adapters';
