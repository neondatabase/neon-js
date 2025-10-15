import type { AuthClient } from '@/auth/auth-interface';
import { PostgrestClient } from '@supabase/postgrest-js';
import { fetchWithAuth } from '@/client/fetch-with-auth';
import { StackAuthAdapter } from '@/auth/adapters/stack-auth/stack-auth-adapter';
import type {
  StackClientAppConstructorOptions,
  StackServerAppConstructorOptions,
} from '@stackframe/js';

// Support both client and server Stack Auth options
type StackAuthOptions<
  HasTokenStore extends boolean = boolean,
  ProjectId extends string = string
> =
  | StackClientAppConstructorOptions<HasTokenStore, ProjectId>
  | StackServerAppConstructorOptions<HasTokenStore, ProjectId>;

// Internal constructor options (accepts auth options at runtime)
type NeonClientConstructorOptions<
  HasTokenStore extends boolean = boolean,
  ProjectId extends string = string
> = {
  url: string;
  auth: StackAuthOptions<HasTokenStore, ProjectId>;
  fetch?: typeof fetch;
};

// Public-facing options for createClient (options only)
export type CreateClientOptions<
  HasTokenStore extends boolean = boolean,
  ProjectId extends string = string
> = {
  url: string;
  auth: StackAuthOptions<HasTokenStore, ProjectId>;
};

export class NeonClient extends PostgrestClient {
  auth!: AuthClient;

  constructor({ url, auth, fetch: customFetch }: NeonClientConstructorOptions) {
    super(url, {
      fetch: customFetch,
    });

    // Auth will be assigned by factory after construction
  }
}

/**
 * Factory function to create NeonClient with seamless auth integration
 *
 * @param options - Configuration options
 * @returns NeonClient instance with auth-aware fetch wrapper
 * @throws AuthRequiredError when making requests without authentication
 */
export function createClient<
  HasTokenStore extends boolean = boolean,
  ProjectId extends string = string
>({
  url,
  auth: authOptions,
}: CreateClientOptions<HasTokenStore, ProjectId>): NeonClient {
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
  const client = new NeonClient({
    url,
    auth: authOptions,
    fetch: authFetch,
  });

  // Step 5: Assign the instantiated auth client
  client.auth = auth;

  return client;
}
