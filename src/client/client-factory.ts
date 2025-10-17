import { StackAuthAdapter } from '@/auth/adapters/stack-auth/stack-auth-adapter';
import { fetchWithAuth } from '@/client/fetch-with-auth';
import { NeonClient, type StackAuthOptions } from '@/client/neon-client';

// Public-facing options for createClient (options only)
export type CreateClientOptions = {
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
  SchemaName extends string & keyof Database = 'public' extends keyof Database
    ? 'public'
    : string & keyof Database,
>({
  url,
  auth: authOptions,
}: CreateClientOptions): NeonClient<Database, SchemaName> {
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
  const authFetch = fetchWithAuth(getAccessToken);

  // Step 4: Create client with auth options
  const client = new NeonClient<Database, SchemaName>({
    url,
    auth: authOptions,
    fetch: authFetch,
  });

  // Step 5: Assign the instantiated auth client
  client.auth = auth;

  return client;
}
