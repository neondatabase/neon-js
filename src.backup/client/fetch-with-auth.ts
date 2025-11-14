/**
 * Fetch wrapper that automatically injects authentication headers
 * Based on Supabase's fetchWithAuth pattern, adapted for Neon
 */

type Fetch = typeof fetch;
type GetAccessToken = () => Promise<string | null>;

/**
 * Error thrown when authentication is required but no session exists
 */
export class AuthRequiredError extends Error {
  constructor(
    message = 'Authentication required. User must be signed in to access Neon database.'
  ) {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

/**
 * Creates a fetch wrapper that injects auth headers into every request
 *
 * Unlike Supabase, Neon requires authentication - requests without a valid
 * session will throw an AuthRequiredError.
 *
 * @param getAccessToken - Async function that returns current access token
 * @param customFetch - Optional custom fetch implementation
 * @returns Wrapped fetch function with auth headers
 */
export function fetchWithAuth(
  getAccessToken: GetAccessToken,
  customFetch?: Fetch
): Fetch {
  const baseFetch = customFetch ?? fetch;

  return async (
    input: string | URL | Request,
    init?: RequestInit
  ): Promise<Response> => {
    // Get current access token (lazy resolution - called on every request)
    const accessToken = await getAccessToken();

    // Neon requires authentication - throw if no token
    if (!accessToken) {
      throw new AuthRequiredError();
    }

    // Clone headers to avoid mutation
    const headers = new Headers(init?.headers);

    // Inject Authorization header if not present (respects user overrides)
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    // Execute request with injected headers
    return baseFetch(input, { ...init, headers });
  };
}
