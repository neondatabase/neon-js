import { NextRequest, NextResponse } from 'next/server';
import { needsSessionVerification, exchangeOAuthToken } from './oauth';
import { NEON_AUTH_BASE_URL } from '../env-variables';
import { ERRORS } from '../errors';
import { fetchSession } from '../auth/session';
import { NEON_AUTH_HEADER_MIDDLEWARE_NAME } from '../constants';

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
  /*
   *  The URL to redirect to when the user is not authenticated.
   *  Defaults to `/auth/sign-in`
   */
  loginUrl?: string;
};

/**
 * A Next.js middleware to protect routes from unauthenticated requests and refresh the session if required.
 *
 * @param loginUrl - The URL to redirect to when the user is not authenticated.
 * @returns A middleware function that can be used in the Next.js app.
 *
 * @example
 * ```ts
 * import { neonAuthMiddleware } from "@neondatabase/auth/next"
 *
 * export default neonAuthMiddleware({
 *   loginUrl: '/auth/sign-in',
 * });
 * ```
 */
export function neonAuthMiddleware({
  loginUrl = '/auth/sign-in',
}: NeonAuthMiddlewareOptions) {
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
