import type { VanillaBetterAuthClient } from '../neon-auth';
import type { API_ENDPOINTS } from './endpoints';

/**
 * Extract top-level keys from API_ENDPOINTS.
 * For nested endpoints like signIn.email, this extracts 'signIn' (not 'email').
 */
type TopLevelEndpointKeys<T> = {
  [K in keyof T]: K;
}[keyof T];

type ServerAuthMethods = TopLevelEndpointKeys<typeof API_ENDPOINTS>;
export type NeonAuthServer = Pick<VanillaBetterAuthClient, ServerAuthMethods>;
