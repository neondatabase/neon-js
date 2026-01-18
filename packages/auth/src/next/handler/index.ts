import { ERRORS } from '@/server/errors';
import { handleAuthRequest } from './request';
import { handleAuthResponse } from './response';
import { getSessionDataFromCookie, isSessionCacheEnabled } from '@/server/session';
import { NEON_AUTH_SESSION_DATA_COOKIE_NAME } from '../constants';

type Params = { path: string[] };

/**
 * 
 * An API route handler to handle the auth requests from the client and proxy them to the Neon Auth.
 * 
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
 * export const { GET, POST } = authApiHandler();
 * ```
 */
export function authApiHandler() {
  const baseURL = process.env.NEON_AUTH_BASE_URL;
  if (!baseURL) {
    throw new Error(ERRORS.MISSING_AUTH_BASE_URL);
  }

  const handler = async (
    request: Request,
    { params }: { params: Promise<Params> }
  ) => {
    const resolvedParams = await params;
    const path = resolvedParams.path.join('/');

    // Try cookie cache for /get-session GET requests (if enabled)
    if (isSessionCacheEnabled() &&
        path === 'get-session' &&
        request.method === 'GET') {

      const url = new URL(request.url);
      const disableCookieCache = url.searchParams.get('disableCookieCache');

      // Try cookie validation unless explicitly disabled
      if (disableCookieCache !== 'true') {
        try {
          const sessionData = await getSessionDataFromCookie(
            request,
            NEON_AUTH_SESSION_DATA_COOKIE_NAME
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
    return await handleAuthResponse(response);
  };

  return {
    GET: handler,
    POST: handler,
    PUT: handler,
    DELETE: handler,
    PATCH: handler,
  };
};
