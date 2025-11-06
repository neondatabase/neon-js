import { BetterAuthAdapter } from '@/auth/adapters/better-auth/better-auth-adapter';
import { fetchWithAuth } from '@/client/fetch-with-auth';
import {
  NeonClient,
  type DefaultSchemaName,
  type NeonClientConstructorOptions,
} from '@/client/neon-client';
import type { BetterAuthClientOptions } from 'better-auth/client';
import type { OnAuthStateChangeConfig } from '@/auth/adapters/better-auth/better-auth-types';

// Support Better Auth options with optional configuration
export type BetterAuthOptions = BetterAuthClientOptions & {
  config?: OnAuthStateChangeConfig;
};

// Public-facing options for createClient (options only)
export type CreateClientOptions<SchemaName> =
  NeonClientConstructorOptions<SchemaName> & {
    auth: BetterAuthOptions;
  };

/**
 * Factory function to create NeonClient with seamless auth integration
 *
 * @param options - Configuration options
 * @returns NeonClient instance with auth-aware fetch wrapper
 * @throws AuthRequiredError when making requests without authentication
 */
export function createClient<
  Database = any,
  SchemaName extends string & keyof Database = DefaultSchemaName<Database>,
>({
  url,
  auth: authOptions,
  options,
}: CreateClientOptions<SchemaName>): NeonClient<Database, SchemaName> {
  // Step 1: Extract config if provided
  const { config, ...betterAuthParams } = authOptions;

  // Step 2: Instantiate auth adapter from options
  const auth = new BetterAuthAdapter(betterAuthParams, config);

  // Step 3: Create lazy token accessor - called on every request
  // Returns null if no session (will throw AuthRequiredError in fetchWithAuth)
  const getAccessToken = async (): Promise<string | null> => {
    const { data, error } = await auth.getJwtToken();

    if (error || !data.token) {
      return null;
    }

    return data.token;
  };

  // Step 4: Create auth-aware fetch wrapper
  const authFetch = fetchWithAuth(getAccessToken, options?.global?.fetch);

  // Step 5: Create client with auth options
  const client = new NeonClient<Database, SchemaName>({
    url,
    options: {
      ...options,
      global: {
        ...options?.global,
        fetch: authFetch,
      },
    },
  });

  // Step 6: Assign the instantiated auth client
  client.auth = auth;

  return client;
}
