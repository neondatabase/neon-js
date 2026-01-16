import { NextRequest, NextResponse } from 'next/server';
import { needsSessionVerification, exchangeOAuthToken } from './oauth';
import { NEON_AUTH_BASE_URL } from '../env-variables';
import { ERRORS } from '../errors';
import { fetchSession } from '../auth/session';
import { NEON_AUTH_HEADER_MIDDLEWARE_NAME, NEON_AUTH_SESSION_DATA_COOKIE_NAME } from '../constants';
import { validateSessionData } from '../../server/session';

const AUTH_API_ROUTES = '/api/auth';
const SKIP_ROUTES = [
  AUTH_API_ROUTES,
  // Routes added by `auth-ui`
  '/auth/callback',
  '/auth/sign-in',
  '/auth/sign-up',
  '/auth/magic-link',
  '/auth/email-otp',
  '/auth/forgot-password',
];

type NeonAuthMiddlewareOptions = {
  /**
   * The URL to redirect to when the user is not authenticated.
   * Defaults to `/auth/sign-in`
   */
  loginUrl?: string;
  /**
   * Session cache configuration
   */
  sessionCache?: {
    /**
     * Enable session data cookie validation to eliminate API calls.
     * Requires NEON_AUTH_COOKIE_SECRET environment variable.
     * Defaults to `true`.
     */
    enabled?: boolean;
  };
};

/**
 * A Next.js middleware to protect routes from unauthenticated requests and refresh the session if required.
 *
 * @param options - Middleware configuration options
 * @param options.loginUrl - The URL to redirect to when the user is not authenticated (default: '/auth/sign-in')
 * @param options.sessionCache - Session cache configuration
 * @param options.sessionCache.enabled - Enable session data cookie validation to reduce API calls (default: true, requires NEON_AUTH_COOKIE_SECRET env var)
 * @returns A middleware function that can be used in the Next.js app.
 *
 * @example
 * ```ts
 * import { neonAuthMiddleware } from "@neondatabase/auth/next"
 *
 * export default neonAuthMiddleware({
 *   loginUrl: '/auth/sign-in',
 *   sessionCache: {
 *     enabled: true, // Optional (default: true)
 *   },
 * });
 * ```
 */
export function neonAuthMiddleware({
  loginUrl = '/auth/sign-in',
  sessionCache = { enabled: true },
}: NeonAuthMiddlewareOptions = {}) {
  const baseUrl = NEON_AUTH_BASE_URL;
  if (!baseUrl) {
    throw new Error(ERRORS.MISSING_AUTH_BASE_URL);
  }

  return async (request: NextRequest) => {
    const { pathname } = request.nextUrl;

    // Always skip session check for login URL to prevent infinite redirect loop
    if (pathname.startsWith(loginUrl)) {
      return NextResponse.next();
    }

    // For OAuth flow, the callback from Neon Auth will include a session verifier token in the query params.
    // We need to exchange the verifier token and session challenge for the session cookie
    const verification = needsSessionVerification(request);
    if (verification) {
      const response = await exchangeOAuthToken(request, baseUrl);
      if (response !== null) {
        return response;
      }
    }

    if (SKIP_ROUTES.some((route) => pathname.startsWith(route))) {
      return NextResponse.next();
    }

    // Fast path: Check session data cookie (no API calls)
    if (sessionCache.enabled) {
      const sessionDataCookie = request.cookies.get(NEON_AUTH_SESSION_DATA_COOKIE_NAME)?.value;

      if (sessionDataCookie) {
        const result = await validateSessionData(sessionDataCookie);

        if (result.valid) {
          // Valid session cache - allow request without API call
          const reqHeaders = new Headers(request.headers);
          reqHeaders.set(NEON_AUTH_HEADER_MIDDLEWARE_NAME, 'true');

          return NextResponse.next({
            request: { headers: reqHeaders },
          });
        }
      }
    }

    // Fallback: Fetch session from upstream (creates session data cookie)
    const session = await fetchSession();
    if (session.session === null) {
      return NextResponse.redirect(new URL(loginUrl, request.url));
    }

    const reqHeaders = new Headers(request.headers);
    reqHeaders.set(NEON_AUTH_HEADER_MIDDLEWARE_NAME, 'true');

    return NextResponse.next({
      request: {
        headers: reqHeaders,
      },
    });
  };
}
