import { handleAuthRequest } from './request';
import { handleAuthResponse } from './response';
import { getSessionDataFromCookie } from '@/server/session';
import { NEON_AUTH_SESSION_DATA_COOKIE_NAME } from '@/server/constants';
import { API_ENDPOINTS } from '@/server/endpoints';
import type { NeonAuthConfig } from '../config';
import { validateCookieSecret } from '../config';

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

  // Validate cookie secret
  validateCookieSecret(cookieSecret);

  const handler = async (
    request: Request,
    { params }: { params: Promise<Params> }
  ) => {
    const resolvedParams = await params;
    const path = resolvedParams.path.join('/');

    // Try cookie cache for /get-session GET requests
    if (path === API_ENDPOINTS.getSession.path &&
        request.method === API_ENDPOINTS.getSession.method) {

      const url = new URL(request.url);
      const disableCookieCache = url.searchParams.get('disableCookieCache');

      // Try cookie validation unless explicitly disabled
      if (disableCookieCache !== 'true') {
        try {
          const sessionData = await getSessionDataFromCookie(
            request,
            NEON_AUTH_SESSION_DATA_COOKIE_NAME,
            cookieSecret
          );

          if (sessionData && sessionData.session) {
            // Cache hit - return immediately (no upstream call)
            return Response.json(sessionData);
          }
        } catch (error) {
          // Validation error - log and fall through to upstream
          console.error('[authApiHandler] Cookie validation error:', {
            error: error instanceof Error ? error.message : String(error),
            path,
          });
        }
      }
    }

    // Fallback: Call upstream API
    const response = await handleAuthRequest(baseUrl, request, path);
    return await handleAuthResponse(response, { baseUrl, cookieSecret });
  };

  return {
    GET: handler,
    POST: handler,
    PUT: handler,
    DELETE: handler,
    PATCH: handler,
  };
};
