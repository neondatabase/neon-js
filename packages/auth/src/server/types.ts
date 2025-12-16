import type { VanillaBetterAuthClient } from '../neon-auth';
import type { API_ENDPOINTS } from './endpoints';

type FlattenEndpointKeys<T> = T extends { path: string; method: string }
  ? never
  : {
      [K in keyof T]: T[K] extends { path: string; method: string }
        ? K
        : FlattenEndpointKeys<T[K]>;
    }[keyof T];

/**
 * Get the top-level keys from API_ENDPOINTS.
 * These are the method names that will be available on NeonAuthServer.
 */
type ServerAuthMethods = FlattenEndpointKeys<typeof API_ENDPOINTS>;
export type NeonAuthServer = Pick<VanillaBetterAuthClient, ServerAuthMethods>;
