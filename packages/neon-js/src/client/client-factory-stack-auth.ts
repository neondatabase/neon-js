import { StackAuthAdapter } from '@neon-js/auth/stack-auth';
import { fetchWithAuth } from './fetch-with-auth';
import {
  NeonClient,
  type DefaultSchemaName,
  type NeonClientConstructorOptions,
} from './neon-client';
import type {
  StackClientAppConstructorOptions,
  StackServerAppConstructorOptions,
} from '@stackframe/js';

// Support both client and server Stack Auth options
type StackAuthOptions<
  HasTokenStore extends boolean = boolean,
  ProjectId extends string = string,
> =
  | StackClientAppConstructorOptions<HasTokenStore, ProjectId>
  | StackServerAppConstructorOptions<HasTokenStore, ProjectId>;

// Public-facing options for createClient (options only)
export type CreateClientOptions<SchemaName> = Omit<
  NeonClientConstructorOptions<SchemaName>,
  'dataApiUrl'
> & {
  url: string;
  auth: StackAuthOptions;
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
  // Step 1: Instantiate auth adapter from options
  const auth = new StackAuthAdapter(authOptions);

  // Step 2: Create lazy token accessor - called on every request
  // Returns null if no session (will throw AuthRequiredError in fetchWithAuth)
  const getAccessToken = async (): Promise<string | null> => {
    const { data, error } = await auth.getSession();

    if (error || !data.session) {
      return null;
    }

    return data.session.access_token;
  };

  // Step 3: Create auth-aware fetch wrapper
  const authFetch = fetchWithAuth(getAccessToken, options?.global?.fetch);

  // Step 4: Create client with auth options
  const client = new NeonClient<Database, SchemaName>({
    dataApiUrl: url,
    options: {
      ...options,
      global: {
        ...options?.global,
        fetch: authFetch,
      },
    },
  });

  // Step 5: Assign the instantiated auth client
  client.auth = auth;

  return client;
}
