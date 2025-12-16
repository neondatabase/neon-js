import type { VanillaBetterAuthClient } from '../neon-auth';

/**
 * Server auth client type.
 *
 * This type is derived from VanillaBetterAuthClient to ensure type parity
 * between client and server APIs. We pick only the methods that make sense
 * on the server (excluding React hooks like useSession).
 */
export type NeonAuthServer = Pick<
  VanillaBetterAuthClient,
  // Session
  | 'getSession'

  // User
  | 'listAccounts'

  // JWT
  | 'token'
>;
