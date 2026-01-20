import { ERRORS } from '@/server/errors';
import { handleAuthRequest } from './request';
import { handleAuthResponse } from './response';
import { getSessionDataFromCookie } from '@/server/session';
import { NEON_AUTH_SESSION_DATA_COOKIE_NAME } from '../constants';
import { API_ENDPOINTS } from '@/server/endpoints';
import { assertCookieSecret, assertDefined } from '@/server/session/validator';

type Params = { path: string[] };

/**
 *
 * An API route handler to handle the auth requests from the client and proxy them to the Neon Auth.
 *
 * @param config - Optional configuration (falls back to environment variables)
 * @param config.baseUrl - Optional base URL (falls back to NEON_AUTH_BASE_URL env var)
 * @param config.cookieSecret - Optional cookie secret (falls back to NEON_AUTH_COOKIE_SECRET env var)
 * @returns A Next.js API handler functions those can be used in a Next.js route.
 *
 * @example
 * Mount the `authApiHandler` to an API route. Create a route file inside `/api/auth/[...all]/route.ts` directory.
 *  And add the following code:
 *
 * ```ts
 * // app/api/auth/[...all]/route.ts
 * import { authApiHandler } from '@neondatabase/auth/next';
 *
 * // Uses environment variables (backward compatible)
 * export const { GET, POST } = authApiHandler();
 *
 * // Or with explicit config
 * export const { GET, POST } = authApiHandler({
 *   baseUrl: 'https://auth.example.com',
 *   cookieSecret: process.env.SECRET
 * });
 * ```
 */
export function authApiHandler(config?: {
  baseUrl?: string;
  cookieSecret?: string;
}) {
  const baseURL = config?.baseUrl ?? process.env.NEON_AUTH_BASE_URL;
  const cookieSecret = config?.cookieSecret ?? process.env.NEON_AUTH_COOKIE_SECRET;
  
  assertDefined(baseURL, new Error(ERRORS.MISSING_AUTH_BASE_URL));
  const handler = async (
    request: Request,
    { params }: { params: Promise<Params> }
  ) => {
    const resolvedParams = await params;
    const path = resolvedParams.path.join('/');

    // Try cookie cache for /get-session GET requests (if enabled)
    if (cookieSecret &&
        path === API_ENDPOINTS.getSession.path &&
        request.method === API_ENDPOINTS.getSession.method) {

      assertCookieSecret(cookieSecret);
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
    const response = await handleAuthRequest(baseURL, request, path);
    return await handleAuthResponse(response, { baseUrl: baseURL, cookieSecret });
  };

  return {
    GET: handler,
    POST: handler,
    PUT: handler,
    DELETE: handler,
    PATCH: handler,
  };
};
