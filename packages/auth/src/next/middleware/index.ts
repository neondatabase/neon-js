import { NextRequest, NextResponse } from 'next/server';
import { needsSessionVerification, exchangeOAuthToken } from './oauth';
import { NEON_AUTH_BASE_URL } from '../env-variables';
import { ERRORS } from '@/server/errors';
import { fetchSession } from '../auth/session';
import { NEON_AUTH_HEADER_MIDDLEWARE_NAME, NEON_AUTH_SESSION_DATA_COOKIE_NAME } from '../constants';
import { validateSessionData } from '../../server/session';
import { assertCookieSecret, assertDefined } from '@/server/session/validator';

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
   * Optional base URL for Neon Auth (falls back to environment variable)
   */
  baseUrl?: string;
  /**
   * Optional cookie secret for session caching (falls back to environment variable)
   */
  cookieSecret?: string;
};

/**
 * A Next.js middleware to protect routes from unauthenticated requests and refresh the session if required.
 *
 * @param options - Middleware configuration options
 * @param options.loginUrl - The URL to redirect to when the user is not authenticated (default: '/auth/sign-in')
 * @param options.baseUrl - Optional base URL (falls back to environment variable)
 * @param options.cookieSecret - Optional cookie secret (falls back to environment variable)
 * @returns A middleware function that can be used in the Next.js app.
 *
 * @example
 * ```ts
 * import { neonAuthMiddleware } from "@neondatabase/auth/next"
 *
 * // Uses environment variables (backward compatible)
 * export default neonAuthMiddleware({
 *   loginUrl: '/auth/sign-in'
 * });
 *
 * // Or with explicit config
 * export default neonAuthMiddleware({
 *   loginUrl: '/auth/sign-in',
 *   baseUrl: 'https://auth.example.com',
 *   cookieSecret: process.env.SECRET
 * });
 * ```
 */
export function neonAuthMiddleware({
  loginUrl = '/auth/sign-in',
  baseUrl: configBaseUrl,
  cookieSecret: configCookieSecret,
}: NeonAuthMiddlewareOptions = {}) {
  const baseUrl = configBaseUrl ?? NEON_AUTH_BASE_URL;
  const cookieSecret = configCookieSecret ?? process.env.NEON_AUTH_COOKIE_SECRET;

  assertDefined(baseUrl, new Error(ERRORS.MISSING_AUTH_BASE_URL));
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
      const response = await exchangeOAuthToken(request, baseUrl, cookieSecret);
      if (response !== null) {
        return response;
      }
    }

    if (SKIP_ROUTES.some((route) => pathname.startsWith(route))) {
      return NextResponse.next();
    }

    // Try session cookie cache if enabled (backward compatible)
    if (cookieSecret) {
      assertCookieSecret(cookieSecret);
      
      const sessionDataCookie = request.cookies.get(NEON_AUTH_SESSION_DATA_COOKIE_NAME)?.value;
      if (sessionDataCookie) {
        try {
          const result = await validateSessionData(sessionDataCookie, cookieSecret);

          if (result.valid) {
            // Cache hit - fast path (no API call)
            const reqHeaders = new Headers(request.headers);
            reqHeaders.set(NEON_AUTH_HEADER_MIDDLEWARE_NAME, 'true');

            return NextResponse.next({
              request: { headers: reqHeaders },
            });
          } else {
            // Cache miss - invalid cookie
            console.debug('[neonAuthMiddleware] Invalid session cookie:', {
              pathname,
              error: result.error,
            });
          }
        } catch (error) {
          // Validation error - log and fall through to API call
          console.error('[neonAuthMiddleware] Cookie validation error:', {
            pathname,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    // Fallback: Fetch session from upstream (creates session data cookie)
    const session = await fetchSession({ disableRefresh: true, baseUrl, cookieSecret });
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
