import {
  NeonAuthClient,
  type NeonAuthClientOptions,
} from '@neondatabase/auth-js';
import { fetchWithToken } from '@neondatabase/postgrest-js';
import {
  NeonClient,
  type DefaultSchemaName,
  type NeonClientConstructorOptions,
} from './neon-client';

// Public-facing options for createClient (options only)
export type CreateClientOptions<SchemaName> = {
  clientOptions?: Omit<
    NeonClientConstructorOptions<SchemaName>,
    'dataApiUrl' | 'authClient'
  >;
  authOptions?: NeonAuthClientOptions;
};

/**
 * Factory function to create NeonClient with seamless auth integration
 *
 * @param neonUrl - The Neon URL
 * @param options - Configuration options
 * @returns NeonClient instance with auth-aware fetch wrapper
 * @throws AuthRequiredError when making requests without authentication
 */
export function createClient<
  Database = any,
  SchemaName extends string & keyof Database = DefaultSchemaName<Database>,
>(
  neonUrl: string,
  {
    clientOptions: neonClientOptions,
    authOptions,
  }: CreateClientOptions<SchemaName> = {}
): NeonClient<Database, SchemaName> {
  const { dataApiUrl, authUrl } = getNeonUrls(neonUrl);

  // Step 2: Instantiate auth adapter from options
  const auth = new NeonAuthClient({ baseURL: authUrl, ...authOptions });

  // Step 3: Create lazy token accessor - called on every request
  // Returns null if no session (will throw AuthRequiredError in fetchWithToken)
  // Note: session.access_token contains the JWT (not opaque token) for API authentication
  const getAccessToken = async (): Promise<string | null> => {
    const { data, error } = await auth.getSession();

    if (error || !data.session) {
      return null;
    }

    return data.session.access_token; // This is the JWT token
  };

  // Step 4: Create auth-aware fetch wrapper
  const authFetch = fetchWithToken(
    getAccessToken,
    neonClientOptions?.options?.global?.fetch
  );

  // Step 5: Create client with auth integrated
  const client = new NeonClient<Database, SchemaName>({
    dataApiUrl,
    authClient: auth,
    options: {
      ...neonClientOptions?.options,
      global: {
        ...neonClientOptions?.options?.global,
        fetch: authFetch,
      },
    },
  });

  return client;
}

/**
 * Get the Neon URLs for a given base branch URL
 * @param baseBranchUrl - The base branch URL
 * @returns The Neon URLs
 * example baseBranchUrl: https://ep-round-waterfall-w15wzz10.eu-west-1.aws.neon.build/neondb/
 * example dataApiUrl: https://ep-round-waterfall-w15wzz10.apirest.eu-west-1.aws.neon.build/neondb/rest/v1
 * example authUrl: https://ep-round-waterfall-w15wzz10.neonauth.eu-west-1.aws.neon.build/neondb/auth
 */
function getNeonUrls(baseBranchUrl: string) {
  const urlObj = new URL(baseBranchUrl);

  // Extract hostname parts: ep-round-waterfall-w15wzz10.eu-west-1.aws.neon.build
  const hostname = urlObj.hostname;
  const hostnameParts = hostname.split('.');

  // First part is the subdomain (e.g., "ep-round-waterfall-w15wzz10")
  const subdomain = hostnameParts[0];

  // Rest is region + domain (e.g., ["eu-west-1", "aws", "neon", "build"])
  const regionAndDomain = hostnameParts.slice(1).join('.');

  // Extract pathname (e.g., "/neondb/" or "/neondb") and normalize it
  // Handle both "/neondb/" and "/neondb" - ensure it ends with "/"
  const pathname = urlObj.pathname.endsWith('/')
    ? urlObj.pathname
    : `${urlObj.pathname}/`;

  // Construct dataApiUrl: subdomain.apirest.region.domain + pathname + "rest/v1"
  // Works with both "/neondb/" -> "/neondb/rest/v1" and "/neondb" -> "/neondb/rest/v1"
  const dataApiUrl = `${urlObj.protocol}//${subdomain}.apirest.${regionAndDomain}${pathname}rest/v1`;

  // Construct authUrl: subdomain.neonauth.region.domain + pathname + "auth"
  // Works with both "/neondb/" -> "/neondb/auth" and "/neondb" -> "/neondb/auth"
  const authUrl = `${urlObj.protocol}//${subdomain}.neonauth.${regionAndDomain}${pathname}auth`;

  return {
    dataApiUrl,
    authUrl,
  };
}
