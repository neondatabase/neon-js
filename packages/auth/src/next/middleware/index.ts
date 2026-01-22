import { NextRequest, NextResponse } from 'next/server';
import { needsSessionVerification, exchangeOAuthToken } from './oauth';
import { fetchSession } from '../auth/session';
import { NEON_AUTH_HEADER_MIDDLEWARE_NAME } from '../constants';
import { NEON_AUTH_SESSION_DATA_COOKIE_NAME } from '@/server/constants';
import { validateSessionData } from '../../server/session';
import type { NeonAuthMiddlewareConfig } from '../config';
import { validateCookieSecret } from '../config';

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

/**
 * A Next.js middleware to protect routes from unauthenticated requests and refresh the session if required.
 *
 * @param config - Required middleware configuration
 * @param config.baseUrl - Base URL of your Neon Auth instance
 * @param config.cookieSecret - Secret for signing session cookies (minimum 32 characters)
 * @param config.loginUrl - The URL to redirect to when the user is not authenticated (default: '/auth/sign-in')
 * @returns A middleware function that can be used in the Next.js app.
 * @throws Error if `cookieSecret` is less than 32 characters
 *
 * @example
 * ```ts
 * import { neonAuthMiddleware } from "@neondatabase/auth/next"
 *
 * export default neonAuthMiddleware({
 *   baseUrl: process.env.NEON_AUTH_BASE_URL!,
 *   cookieSecret: process.env.NEON_AUTH_COOKIE_SECRET!,
 *   loginUrl: '/auth/sign-in',
 * });
 * ```
 */
export function neonAuthMiddleware(config: NeonAuthMiddlewareConfig) {
  const { baseUrl, cookieSecret, loginUrl = '/auth/sign-in' } = config;

  // Validate cookie secret
  validateCookieSecret(cookieSecret);
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

    // Try session cookie cache first
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
