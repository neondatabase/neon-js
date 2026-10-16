import { createAuthClient } from 'better-auth/react';
import {
  NeonAuthAdapterCore,
  type NeonAuthAdapterCoreAuthOptions,
  type SupportedBetterAuthClientPlugins
} from '../../core/adapter-core';
import {
  neonExpoClient,
  type NeonExpoClientOptions
} from '../../expo/expo-client';

export type BetterAuthExpoAdapterOptions = Omit<
  NeonExpoClientOptions,
  'storageKey'
> &
  Omit<NeonAuthAdapterCoreAuthOptions, 'baseURL'> & {
    /** Alphanumeric prefix for keys stored in Expo SecureStore. */
    storagePrefix?: string;
  };

export function getExpoStorageKey(
  baseURL: string,
  storagePrefix = 'neon-auth'
): string {
  if (!/^[\w.-]+$/.test(storagePrefix)) {
    throw new Error(
      'Expo storagePrefix can only contain letters, numbers, ".", "-", and "_"'
    );
  }
  let hash = 2_166_136_261;
  for (let index = 0; index < baseURL.length; index += 1) {
    hash ^= baseURL.codePointAt(index) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return `${storagePrefix}_${(hash >>> 0).toString(36)}_cookie`;
}

/**
 * Internal implementation class - use BetterAuthExpoAdapter factory function instead
 */
class BetterAuthExpoAdapterImpl extends NeonAuthAdapterCore {
  private _betterAuth: ReturnType<
    typeof createAuthClient<{ plugins: SupportedBetterAuthClientPlugins }>
  >;

  constructor(options: BetterAuthExpoAdapterOptions & { baseURL: string }) {
    const {
      baseURL,
      scheme,
      storage,
      storagePrefix,
      browser,
      ...clientOptions
    } = options;
    super(
      { ...clientOptions, baseURL },
      [
        neonExpoClient({
          scheme,
          storageKey: getExpoStorageKey(baseURL, storagePrefix),
          storage,
          browser
        })
      ]
    );
    this._betterAuth = createAuthClient(this.betterAuthOptions);
  }

  getBetterAuthInstance() {
    return this._betterAuth;
  }
}

/** Instance type for BetterAuthExpoAdapter */
export type BetterAuthExpoAdapterInstance = BetterAuthExpoAdapterImpl;

/** Builder type that creates adapter instances */
type BetterAuthExpoAdapterBuilder = (
  url: string,
  fetchOptions?: { headers?: Record<string, string> }
) => BetterAuthExpoAdapterInstance;

/**
 * Factory function that returns an Expo adapter builder.
 * The builder is called by createClient/createAuthClient with the URL.
 *
 * @param options - Expo and Better Auth client configuration
 * @returns A builder function that creates the adapter instance
 *
 * @example
 * ```typescript
 * const auth = createAuthClient('https://auth.example.com', {
 *   adapter: BetterAuthExpoAdapter({
 *     scheme: 'myapp',
 *     storage: SecureStore,
 *     browser: WebBrowser,
 *   }),
 * });
 * ```
 */
export function BetterAuthExpoAdapter(
  options: BetterAuthExpoAdapterOptions
): BetterAuthExpoAdapterBuilder {
  return (url, fetchOptions) =>
    new BetterAuthExpoAdapterImpl({
      baseURL: url,
      ...options,
      fetchOptions: {
        ...options.fetchOptions,
        headers: {
          ...options.fetchOptions?.headers,
          ...fetchOptions?.headers
        }
      }
    });
}
