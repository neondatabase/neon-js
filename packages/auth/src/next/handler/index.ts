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
    console.time('authApiHandler');
    

    // Fast path: Optimize /get-session with session data cookie
    if (path === 'get-session' && request.method === 'GET') {
      const url = new URL(request.url);
      const disableCookieCache = url.searchParams.get('disableCookieCache');

      // Try cookie validation unless explicitly disabled
      if (disableCookieCache !== 'true') {
        console.time('authApiHandler:getSessionDataFromCookie');
        const sessionData = await getSessionDataFromCookie(request, NEON_AUTH_SESSION_DATA_COOKIE_NAME);
        console.timeEnd('authApiHandler:getSessionDataFromCookie');
        if (sessionData && sessionData.session) {
          // Valid cookie - return directly without upstream call
          console.timeEnd('authApiHandler');
          return Response.json(sessionData);
        }
      }
    }

    console.time(`authApiHandler:${path}`);
    const response = await handleAuthRequest(baseURL, request, path);
    console.timeEnd(`authApiHandler:${path}`);
    const result = await handleAuthResponse(response, request);
    console.timeEnd('authApiHandler');
    return result;
  };

  return {
    GET: handler,
    POST: handler,
    PUT: handler,
    DELETE: handler,
    PATCH: handler,
  };
};
