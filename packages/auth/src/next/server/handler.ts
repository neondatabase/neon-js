import { handleAuthProxyRequest } from '@/server/proxy';
import type { NeonAuthConfig } from '@/server/config';
import { validateCookieSecret } from '@/server/config';

type Params = { path: string[] };

/**
 * An API route handler to handle the auth requests from the client and proxy them to the Neon Auth.
 *
 * @param config - Required configuration
 * @param config.baseUrl - Base URL of your Neon Auth instance
 * @param config.cookieSecret - Secret for signing session cookies (minimum 32 characters)
 * @returns A Next.js API handler functions that can be used in a Next.js route.
 * @throws Error if `cookieSecret` is less than 32 characters
 *
 * @example
 * Mount the `authApiHandler` to an API route. Create a route file inside `/api/auth/[...all]/route.ts` directory.
 * And add the following code:
 *
 * ```ts
 * // app/api/auth/[...all]/route.ts
 * import { authApiHandler } from '@neondatabase/auth/next';
 *
 * export const { GET, POST } = authApiHandler({
 *   baseUrl: process.env.NEON_AUTH_BASE_URL!,
 *   cookieSecret: process.env.NEON_AUTH_COOKIE_SECRET!,
 * });
 * ```
 */
export function authApiHandler(config: NeonAuthConfig) {
  const { baseUrl, cookieSecret } = config;
  
  validateCookieSecret(cookieSecret);
  const handler = async (
    request: Request,
    { params }: { params: Promise<Params> }
  ) => {
    const resolvedParams = await params;
    const path = resolvedParams.path.join('/');

    return handleAuthProxyRequest({ request, path, baseUrl, cookieSecret });
  };

  return {
    GET: handler,
    POST: handler,
    PUT: handler,
    DELETE: handler,
    PATCH: handler,
  };
};
