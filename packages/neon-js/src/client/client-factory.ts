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
 * Auth configuration for createClient (object form)
 */
export type CreateClientAuthConfig<T extends NeonAuthAdapter> = {
  /** The auth service URL */
  url: string;
} & NeonAuthConfig<T>;

/**
 * Data API configuration for createClient (object form)
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
 * Configuration for createClient (object form)
 */
export type CreateClientConfig<SchemaName, T extends NeonAuthAdapter> = {
  /** Auth service configuration */
  auth: CreateClientAuthConfig<T>;
  /** Data API configuration */
  dataApi: CreateClientDataApiConfig<SchemaName, T>;
};

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

type CreateClientResult<
  Database,
  TAdapter extends NeonAuthAdapter,
> = NeonClient<Database, DefaultSchemaName<Database>, TAdapter>;

// =============================================================================
// Object-form overloads (existing behaviour — unchanged)
// =============================================================================

// Object form, no adapter specified → defaults to BetterAuthVanillaAdapter
export function createClient<Database = any>(config: {
  auth: { url: string; allowAnonymous?: boolean };
  dataApi: CreateClientDataApiConfig<
    DefaultSchemaName<Database>,
    BetterAuthVanillaAdapterInstance
  >;
}): CreateClientResult<Database, BetterAuthVanillaAdapterInstance>;

// Object form, SupabaseAuthAdapter
export function createClient<Database = any>(
  config: CreateClientConfig<
    DefaultSchemaName<Database>,
    SupabaseAuthAdapterInstance
  >
): CreateClientResult<Database, SupabaseAuthAdapterInstance>;

// Object form, BetterAuthVanillaAdapter
export function createClient<Database = any>(
  config: CreateClientConfig<
    DefaultSchemaName<Database>,
    BetterAuthVanillaAdapterInstance
  >
): CreateClientResult<Database, BetterAuthVanillaAdapterInstance>;

// Object form, BetterAuthReactAdapter
export function createClient<Database = any>(
  config: CreateClientConfig<
    DefaultSchemaName<Database>,
    BetterAuthReactAdapterInstance
  >
): CreateClientResult<Database, BetterAuthReactAdapterInstance>;

// =============================================================================
// String-form overloads (new)
// =============================================================================

// String form, no adapter specified → defaults to BetterAuthVanillaAdapter
export function createClient<Database = any>(
  baseUrl: string,
  options?: CreateClientStringOptions<
    DefaultSchemaName<Database>,
    BetterAuthVanillaAdapterInstance
  >
): CreateClientResult<Database, BetterAuthVanillaAdapterInstance>;

// String form, SupabaseAuthAdapter
export function createClient<Database = any>(
  baseUrl: string,
  options: CreateClientStringOptions<
    DefaultSchemaName<Database>,
    SupabaseAuthAdapterInstance
  > & { auth: { adapter: SupabaseAuthAdapterInstance } }
): CreateClientResult<Database, SupabaseAuthAdapterInstance>;

// String form, BetterAuthVanillaAdapter
export function createClient<Database = any>(
  baseUrl: string,
  options: CreateClientStringOptions<
    DefaultSchemaName<Database>,
    BetterAuthVanillaAdapterInstance
  > & { auth: { adapter: BetterAuthVanillaAdapterInstance } }
): CreateClientResult<Database, BetterAuthVanillaAdapterInstance>;

// String form, BetterAuthReactAdapter
export function createClient<Database = any>(
  baseUrl: string,
  options: CreateClientStringOptions<
    DefaultSchemaName<Database>,
    BetterAuthReactAdapterInstance
  > & { auth: { adapter: BetterAuthReactAdapterInstance } }
): CreateClientResult<Database, BetterAuthReactAdapterInstance>;

// =============================================================================
// Implementation
// =============================================================================

export function createClient<
  Database = any,
  SchemaName extends string & keyof Database = DefaultSchemaName<Database>,
  TAuthAdapter extends NeonAuthAdapter = BetterAuthVanillaAdapterInstance,
>(
  arg1:
    | string
    | CreateClientConfig<SchemaName, TAuthAdapter>,
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
