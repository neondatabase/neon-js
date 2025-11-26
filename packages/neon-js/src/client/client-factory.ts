import {
  type NeonAuthAdapterClass,
  type NeonAuthAdapter,
  BetterAuthVanillaAdapter,
  BetterAuthReactAdapter,
  SupabaseAuthAdapter,
} from '@neondatabase/neon-auth';
import { fetchWithToken } from '@neondatabase/postgrest-js';
import {
  NeonClient,
  type DefaultSchemaName,
  type NeonClientConstructorOptions,
} from './neon-client';
import { createInternalNeonAuth } from '@neondatabase/neon-auth';

/**
 * Auth configuration for createClient
 */
export type CreateClientAuthConfig<T extends NeonAuthAdapterClass> = {
  /** The adapter class to use (e.g., SupabaseAuthAdapter, BetterAuthVanillaAdapter) */
  adapter: T;
  /** The auth service URL */
  url: string;
  /** Additional auth options (baseURL is set from url above) */
  options?: Omit<ConstructorParameters<T>[0], 'baseURL'>;
};

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
export type CreateClientConfig<SchemaName, T extends NeonAuthAdapterClass> = {
  /** Auth service configuration */
  auth: CreateClientAuthConfig<T>;
  /** Data API configuration */
  dataApi: CreateClientDataApiConfig<SchemaName, InstanceType<T>>;
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
 * // Auth methods (API depends on adapter)
 * await client.auth.signInWithPassword({ email, password });
 *
 * // Database queries (automatic token injection)
 * const { data: items } = await client.from('items').select();
 * ```
 *
 * @example
 * ```typescript
 * import { createClient, BetterAuthVanillaAdapter } from '@neondatabase/neon-js';
 *
 * const client = createClient({
 *   auth: {
 *     adapter: BetterAuthVanillaAdapter,
 *     url: 'https://auth.example.com',
 *   },
 *   dataApi: {
 *     url: 'https://data-api.example.com/rest/v1',
 *   },
 * });
 *
 * // Access raw Better Auth client
 * const betterAuth = client.auth.getBetterAuthInstance();
 * await betterAuth.signIn.email({ email, password });
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

// Overload: SupabaseAuthAdapter
export function createClient<Database = any>(
  config: CreateClientConfig<
    DefaultSchemaName<Database>,
    typeof SupabaseAuthAdapter
  >
): CreateClientResult<Database, SupabaseAuthAdapter>;

// Overload: BetterAuthVanillaAdapter
export function createClient<Database = any>(
  config: CreateClientConfig<
    DefaultSchemaName<Database>,
    typeof BetterAuthVanillaAdapter
  >
): CreateClientResult<Database, BetterAuthVanillaAdapter>;

// Overload: BetterAuthReactAdapter
export function createClient<Database = any>(
  config: CreateClientConfig<
    DefaultSchemaName<Database>,
    typeof BetterAuthReactAdapter
  >
): CreateClientResult<Database, BetterAuthReactAdapter>;

// Implementation signature
export function createClient<
  Database = any,
  SchemaName extends string & keyof Database = DefaultSchemaName<Database>,
  TAuthAdapter extends NeonAuthAdapterClass = NeonAuthAdapterClass,
>(
  config: CreateClientConfig<SchemaName, TAuthAdapter>
): NeonClient<Database, SchemaName, InstanceType<TAuthAdapter>> {
  const { auth: authConfig, dataApi: dataApiConfig } = config;

  // Step 1: Instantiate auth adapter using createNeonAuth
  const auth = createInternalNeonAuth(authConfig.url, {
    adapter: authConfig.adapter,
    options: authConfig.options,
  });

  // Step 2: Create lazy token accessor - called on every request
  // Returns null if no session (will throw AuthRequiredError in fetchWithToken)
  const getAccessToken = async (): Promise<string | null> => {
    const jwt = await auth.getJWTToken();
    return jwt;
  };

  // Step 3: Create auth-aware fetch wrapper
  const authFetch = fetchWithToken(
    getAccessToken,
    dataApiConfig.options?.global?.fetch
  );

  // Step 4: Create client with auth integrated
  const client = new NeonClient<
    Database,
    SchemaName,
    InstanceType<TAuthAdapter>
  >({
    dataApiUrl: dataApiConfig.url,
    authClient: auth,
    options: {
      ...dataApiConfig.options,
      global: {
        ...dataApiConfig.options?.global,
        fetch: authFetch,
      },
    },
  });

  return client;
}
