import {
  type NeonAuthAdapter,
  createInternalNeonAuth,
  type NeonAuthConfig,
} from '@neondatabase/auth';

// Extended type that includes fetchOptions (not exported in bundled types due to bundler tree-shaking)
type NeonAuthConfigWithFetchOptions<T extends NeonAuthAdapter> =
  NeonAuthConfig<T> & {
    fetchOptions?: { headers?: Record<string, string> };
  };
import {
  type BetterAuthVanillaAdapterInstance,
  type SupabaseAuthAdapterInstance,
} from '@neondatabase/auth/vanilla/adapters';
import { type BetterAuthReactAdapterInstance } from '@neondatabase/auth/react/adapters';
import { fetchWithToken } from '@neondatabase/postgrest-js';
import {
  NeonClient,
  type DefaultSchemaName,
  type NeonClientConstructorOptions,
} from './neon-client';
import {
  buildNeonJsClientInfo,
  X_NEON_CLIENT_INFO_HEADER,
} from '../utils/client-info';

/**
 * Auth configuration for createClient
 */
export type CreateClientAuthConfig<T extends NeonAuthAdapter> = {
  /** The auth service URL */
  url: string;
} & NeonAuthConfig<T>;

/**
 * Data API configuration for createClient
 */
export type CreateClientDataApiConfig<
  SchemaName,
  TAuth extends NeonAuthAdapter,
> = {
  /** The Data API URL */
  url: string;
  /** Additional client options */
  options?: Omit<
    NeonClientConstructorOptions<SchemaName, TAuth>,
    'dataApiUrl' | 'authClient'
  >['options'];
};

/**
 * Configuration for createClient
 */
export type CreateClientConfig<SchemaName, T extends NeonAuthAdapter> = {
  /** Auth service configuration */
  auth: CreateClientAuthConfig<T>;
  /** Data API configuration */
  dataApi: CreateClientDataApiConfig<SchemaName, T>;
};

/**
 * Factory function to create NeonClient with seamless auth integration.
 *
 * @param config - Configuration with auth and dataApi sections
 * @returns NeonClient instance with auth-aware fetch wrapper
 * @throws AuthRequiredError when making requests without authentication
 *
 * @example
 * ```typescript
 * // Simple usage with default BetterAuthVanillaAdapter
 * import { createClient } from '@neondatabase/neon-js';
 *
 * const client = createClient({
 *   auth: { url: 'https://auth.example.com' },
 *   dataApi: { url: 'https://data-api.example.com/rest/v1' },
 * });
 *
 * // Better Auth API
 * await client.auth.signIn.email({ email, password });
 *
 * // Database queries (automatic token injection)
 * const { data: items } = await client.from('items').select();
 * ```
 *
 * @example
 * ```typescript
 * // With SupabaseAuthAdapter for Supabase-compatible API
 * import { createClient, SupabaseAuthAdapter } from '@neondatabase/neon-js';
 *
 * const client = createClient({
 *   auth: {
 *     adapter: SupabaseAuthAdapter,
 *     url: 'https://auth.example.com',
 *   },
 *   dataApi: {
 *     url: 'https://data-api.example.com/rest/v1',
 *   },
 * });
 *
 * // Supabase-compatible auth methods
 * await client.auth.signInWithPassword({ email, password });
 * ```
 */

/**
 * Helper type to create NeonClient with proper schema resolution.
 * Uses 'public' as the default schema since it's the most common case.
 */
type CreateClientResult<
  Database,
  TAdapter extends NeonAuthAdapter,
> = NeonClient<Database, DefaultSchemaName<Database>, TAdapter>;

// Overload: No adapter specified (defaults to BetterAuthVanillaAdapter)
export function createClient<Database = any>(config: {
  auth: { url: string; allowAnonymous?: boolean };
  dataApi: CreateClientDataApiConfig<
    DefaultSchemaName<Database>,
    BetterAuthVanillaAdapterInstance
  >;
}): CreateClientResult<Database, BetterAuthVanillaAdapterInstance>;

// Overload: SupabaseAuthAdapter
export function createClient<Database = any>(
  config: CreateClientConfig<
    DefaultSchemaName<Database>,
    SupabaseAuthAdapterInstance
  >
): CreateClientResult<Database, SupabaseAuthAdapterInstance>;

// Overload: BetterAuthVanillaAdapter
export function createClient<Database = any>(
  config: CreateClientConfig<
    DefaultSchemaName<Database>,
    BetterAuthVanillaAdapterInstance
  >
): CreateClientResult<Database, BetterAuthVanillaAdapterInstance>;

// Overload: BetterAuthReactAdapter
export function createClient<Database = any>(
  config: CreateClientConfig<
    DefaultSchemaName<Database>,
    BetterAuthReactAdapterInstance
  >
): CreateClientResult<Database, BetterAuthReactAdapterInstance>;

// Implementation signature
export function createClient<
  Database = any,
  SchemaName extends string & keyof Database = DefaultSchemaName<Database>,
  TAuthAdapter extends NeonAuthAdapter = BetterAuthVanillaAdapterInstance,
>(
  config: CreateClientConfig<SchemaName, TAuthAdapter>
): NeonClient<Database, SchemaName, TAuthAdapter> {
  const { auth: authConfig, dataApi: dataApiConfig } = config;

  // Build client info once - sub-packages will see it and skip their own injection
  const clientInfoHeader = buildNeonJsClientInfo();

  // Step 1: Instantiate auth adapter using createAuthClient
  // Pass the neon-js client info header so auth requests identify as neon-js
  // Note: fetchOptions is an internal property not exported in bundled types, hence the type assertion
  const auth = createInternalNeonAuth(authConfig.url, {
    adapter: authConfig.adapter,
    allowAnonymous: authConfig.allowAnonymous ?? false,
    fetchOptions: {
      headers: {
        [X_NEON_CLIENT_INFO_HEADER]: clientInfoHeader,
      },
    },
  } as NeonAuthConfigWithFetchOptions<TAuthAdapter>);

  // Step 2: Create lazy token accessor - called on every request
  // Returns null if no session (will throw AuthRequiredError in fetchWithToken)
  const getAccessToken = async (): Promise<string | null> => {
    return auth.getJWTToken();
  };

  // Step 3: Create auth-aware fetch wrapper
  const authFetch = fetchWithToken(
    getAccessToken,
    dataApiConfig.options?.global?.fetch
  );

  // Step 4: Create client with auth integrated
  // Pass the neon-js client info header so data API requests identify as neon-js
  const client = new NeonClient<Database, SchemaName, TAuthAdapter>({
    dataApiUrl: dataApiConfig.url,
    authClient: auth,
    options: {
      ...dataApiConfig.options,
      global: {
        ...dataApiConfig.options?.global,
        fetch: authFetch,
        headers: {
          ...dataApiConfig.options?.global?.headers,
          [X_NEON_CLIENT_INFO_HEADER]: clientInfoHeader,
        },
      },
    },
  });

  return client;
}
