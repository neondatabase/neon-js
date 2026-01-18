import { ERRORS } from '@/server/errors';
import { handleAuthRequest } from './request';
import { handleAuthResponse } from './response';
import { getSessionDataFromCookie } from '@/server/session';
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
    
    if (process.env.NEON_AUTH_COOKIE_SECRET !== undefined && path === 'get-session' && request.method === 'GET') {
      const url = new URL(request.url);
      const disableCookieCache = url.searchParams.get('disableCookieCache');

      // Try cookie validation unless explicitly disabled
      if (disableCookieCache !== 'true') {
        const sessionData = await getSessionDataFromCookie(request, NEON_AUTH_SESSION_DATA_COOKIE_NAME);
        if (sessionData && sessionData.session) {
          return Response.json(sessionData);
        }
      }
    }

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
