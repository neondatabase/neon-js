import {
  type NeonAuthAdapter,
  createInternalNeonAuth,
  type NeonAuthConfig,
} from '@neondatabase/auth';
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
import { defaultDeriveNeonUrls, type DeriveNeonUrls } from './derive-urls';

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
 *
 * @example
 * ```typescript
 * // Single base URL — auth and Data API URLs are derived automatically.
 * const client = createClient(
 *   'https://ep-xxx.c-2.us-east-2.aws.neon.build/dbname'
 * );
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

// Overload: String form, no adapter specified (defaults to BetterAuthVanillaAdapter)
export function createClient<Database = any>(
  baseUrl: string,
  options?: CreateClientStringOptions<
    DefaultSchemaName<Database>,
    BetterAuthVanillaAdapterInstance
  >
): CreateClientResult<Database, BetterAuthVanillaAdapterInstance>;

// Overload: String form, SupabaseAuthAdapter
export function createClient<Database = any>(
  baseUrl: string,
  options: CreateClientStringOptions<
    DefaultSchemaName<Database>,
    SupabaseAuthAdapterInstance
  > & { auth: { adapter: SupabaseAuthAdapterInstance } }
): CreateClientResult<Database, SupabaseAuthAdapterInstance>;

// Overload: String form, BetterAuthVanillaAdapter
export function createClient<Database = any>(
  baseUrl: string,
  options: CreateClientStringOptions<
    DefaultSchemaName<Database>,
    BetterAuthVanillaAdapterInstance
  > & { auth: { adapter: BetterAuthVanillaAdapterInstance } }
): CreateClientResult<Database, BetterAuthVanillaAdapterInstance>;

// Overload: String form, BetterAuthReactAdapter
export function createClient<Database = any>(
  baseUrl: string,
  options: CreateClientStringOptions<
    DefaultSchemaName<Database>,
    BetterAuthReactAdapterInstance
  > & { auth: { adapter: BetterAuthReactAdapterInstance } }
): CreateClientResult<Database, BetterAuthReactAdapterInstance>;

// Implementation signature
export function createClient<
  Database = any,
  SchemaName extends string & keyof Database = DefaultSchemaName<Database>,
  TAuthAdapter extends NeonAuthAdapter = BetterAuthVanillaAdapterInstance,
>(
  arg1: string | CreateClientConfig<SchemaName, TAuthAdapter>,
  arg2?: CreateClientStringOptions<SchemaName, TAuthAdapter>
): NeonClient<Database, SchemaName, TAuthAdapter> {
  const config: CreateClientConfig<SchemaName, TAuthAdapter> =
    typeof arg1 === 'string'
      ? buildConfigFromBaseUrl<SchemaName, TAuthAdapter>(arg1, arg2)
      : arg1;

  const { auth: authConfig, dataApi: dataApiConfig } = config;

  // Build client info once - sub-packages will see it and skip their own injection
  const clientInfoHeader = buildNeonJsClientInfo();

  // Step 1: Instantiate auth adapter
  const auth = createInternalNeonAuth<TAuthAdapter>(authConfig.url, {
    adapter: authConfig.adapter,
    allowAnonymous: authConfig.allowAnonymous ?? false,
    fetchOptions: {
      headers: {
        [X_NEON_CLIENT_INFO_HEADER]: clientInfoHeader,
      },
    },
  });

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

/**
 * Per-call overrides accepted alongside a single base URL.
 *
 * Every field is optional; defaults come from `deriveUrls(baseUrl)`.
 */
export type CreateClientStringOptions<
  SchemaName,
  T extends NeonAuthAdapter,
> = {
  auth?: Partial<CreateClientAuthConfig<T>>;
  dataApi?: Partial<CreateClientDataApiConfig<SchemaName, T>>;
  /**
   * Override the auth/Data API URL derivation. End users do not need this;
   * it is intended for wrapper packages (e.g. `@databricks/lakebase-js`)
   * that have their own endpoint pattern.
   */
  deriveUrls?: DeriveNeonUrls;
};

function buildConfigFromBaseUrl<
  SchemaName,
  TAuthAdapter extends NeonAuthAdapter,
>(
  baseUrl: string,
  options: CreateClientStringOptions<SchemaName, TAuthAdapter> | undefined
): CreateClientConfig<SchemaName, TAuthAdapter> {
  const derive = options?.deriveUrls ?? defaultDeriveNeonUrls;
  const derived = derive(baseUrl);

  const authOverrides = options?.auth ?? {};
  const dataApiOverrides = options?.dataApi ?? {};

  return {
    auth: {
      ...authOverrides,
      url: authOverrides.url ?? derived.auth,
    } as CreateClientAuthConfig<TAuthAdapter>,
    dataApi: {
      ...dataApiOverrides,
      url: dataApiOverrides.url ?? derived.dataApi,
    } as CreateClientDataApiConfig<SchemaName, TAuthAdapter>,
  };
}
