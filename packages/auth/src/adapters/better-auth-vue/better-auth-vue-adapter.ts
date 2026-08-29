import { createAuthClient } from 'better-auth/vue';

import {
  NeonAuthAdapterCore,
  type NeonAuthAdapterCoreAuthOptions,
  type SupportedBetterAuthClientPlugins,
} from '../../core/adapter-core';

export type BetterAuthVueAdapterOptions = Omit<
  NeonAuthAdapterCoreAuthOptions,
  'baseURL'
>;

/**
 * Internal implementation class - use BetterAuthVueAdapter factory function instead
 */
class BetterAuthVueAdapterImpl extends NeonAuthAdapterCore {
  private _betterAuth: ReturnType<
    typeof createAuthClient<{ plugins: SupportedBetterAuthClientPlugins }>
  >;

  constructor(betterAuthClientOptions: NeonAuthAdapterCoreAuthOptions) {
    super(betterAuthClientOptions);
    this._betterAuth = createAuthClient(this.betterAuthOptions);
  }

  getBetterAuthInstance() {
    return this._betterAuth;
  }
}

/** Instance type for BetterAuthVueAdapter */
export type BetterAuthVueAdapterInstance = BetterAuthVueAdapterImpl;

/** Builder type that creates adapter instances */
export type BetterAuthVueAdapterBuilder = (
  url: string,
  fetchOptions?: { headers?: Record<string, string> }
) => BetterAuthVueAdapterInstance;

/**
 * Factory function that returns a Vue adapter builder.
 * The builder is called by createClient/createAuthClient with the URL.
 *
 * @param options - Optional adapter configuration (baseURL is injected separately)
 * @returns A builder function that creates the adapter instance
 */
export function BetterAuthVueAdapter(
  options?: BetterAuthVueAdapterOptions
): BetterAuthVueAdapterBuilder {
  return (url: string, fetchOptions?: { headers?: Record<string, string> }) =>
    new BetterAuthVueAdapterImpl({
      baseURL: url,
      ...options,
      fetchOptions: {
        ...options?.fetchOptions,
        headers: {
          ...options?.fetchOptions?.headers,
          ...fetchOptions?.headers,
        },
      },
    });
}
