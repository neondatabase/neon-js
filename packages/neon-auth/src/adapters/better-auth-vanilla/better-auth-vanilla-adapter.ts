import {
  type BetterAuthClientOptions,
  createAuthClient,
} from 'better-auth/client';

import {
  NeonAuthAdapterCore,
  type NeonAuthAdapterCoreAuthOptions,
} from '../../core/adapter-core';
import type { AuthClient } from 'better-auth/client';

export type BetterAuthVanillaAdapterOptions = Omit<
  NeonAuthAdapterCoreAuthOptions,
  'baseURL'
>;

/**
 * Internal implementation class - use BetterAuthVanillaAdapter factory function instead
 */
class BetterAuthVanillaAdapterImpl extends NeonAuthAdapterCore {
  private _betterAuth: AuthClient<BetterAuthClientOptions>;

  constructor(betterAuthClientOptions: NeonAuthAdapterCoreAuthOptions) {
    super(betterAuthClientOptions);
    this._betterAuth = createAuthClient(this.betterAuthOptions);
  }
  getBetterAuthInstance(): AuthClient<BetterAuthClientOptions> {
    return this._betterAuth;
  }
  async getJWTToken() {
    const session = await this._betterAuth.getSession();
    if (session.error) {
      throw session.error;
    }
    return session.data?.session?.token ?? null;
  }
}

/** Instance type for BetterAuthVanillaAdapter */
export type BetterAuthVanillaAdapterInstance = BetterAuthVanillaAdapterImpl;

/** Builder type that creates adapter instances */
export type BetterAuthVanillaAdapterBuilder = (
  url: string
) => BetterAuthVanillaAdapterInstance;

/**
 * Factory function that returns an adapter builder.
 * The builder is called by createClient/createAuthClient with the URL.
 *
 * @param options - Optional adapter configuration (baseURL is injected separately)
 * @returns A builder function that creates the adapter instance
 *
 * @example
 * ```typescript
 * const client = createClient({
 *   auth: {
 *     url: 'https://auth.example.com',
 *     adapter: BetterAuthVanillaAdapter(),
 *   },
 *   dataApi: { url: 'https://data-api.example.com' },
 * });
 * ```
 */
export function BetterAuthVanillaAdapter(
  options?: BetterAuthVanillaAdapterOptions
): BetterAuthVanillaAdapterBuilder {
  return (url: string) =>
    new BetterAuthVanillaAdapterImpl({ baseURL: url, ...options });
}
