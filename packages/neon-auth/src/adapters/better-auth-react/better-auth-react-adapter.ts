import { createAuthClient } from 'better-auth/react';
import {
  NeonAuthAdapterCore,
  type NeonAuthAdapterCoreAuthOptions,
} from '../../core/adapter-core';

export type BetterAuthReactAdapterOptions = Omit<
  NeonAuthAdapterCoreAuthOptions,
  'baseURL'
>;

/**
 * Internal implementation class - use BetterAuthReactAdapter factory function instead
 */
class BetterAuthReactAdapterImpl extends NeonAuthAdapterCore {
  private _betterAuth: ReturnType<typeof createAuthClient>;

  constructor(betterAuthClientOptions: NeonAuthAdapterCoreAuthOptions) {
    super(betterAuthClientOptions);
    this._betterAuth = createAuthClient(this.betterAuthOptions);
  }
  getBetterAuthInstance() {
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

/** Instance type for BetterAuthReactAdapter */
export type BetterAuthReactAdapterInstance = BetterAuthReactAdapterImpl;

/** Builder type that creates adapter instances */
export type BetterAuthReactAdapterBuilder = (
  url: string
) => BetterAuthReactAdapterInstance;

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
 *     adapter: BetterAuthReactAdapter(),
 *   },
 *   dataApi: { url: 'https://data-api.example.com' },
 * });
 * ```
 */
export function BetterAuthReactAdapter(
  options?: BetterAuthReactAdapterOptions
): BetterAuthReactAdapterBuilder {
  return (url: string) =>
    new BetterAuthReactAdapterImpl({ baseURL: url, ...options });
}
