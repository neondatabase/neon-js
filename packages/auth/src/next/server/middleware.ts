import { NextRequest, NextResponse } from 'next/server';
import { processAuthMiddleware } from '@/server/middleware';
import { fetchSession } from './neon-auth';
import type { NeonAuthMiddlewareConfig } from '@/server/config';
import { validateCookieSecret } from '@/server/config';

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

  validateCookieSecret(cookieSecret);
  return async (request: NextRequest) => {
    const pathname = request.nextUrl.pathname;

    const result = await processAuthMiddleware({
      request,
      pathname,
      skipRoutes: SKIP_ROUTES,
      loginUrl,
      baseUrl,
      cookieSecret,
      fetchSessionFallback: async (url, secret) =>
        fetchSession({ disableRefresh: true, baseUrl: url, cookieSecret: secret }),
    });

    switch (result.action) {
      case 'allow': {
        const headers = new Headers(request.headers);
        if (result.headers) {
          for (const [key, value] of Object.entries(result.headers)) headers.set(key, value);
        }
        return NextResponse.next({ request: { headers } });
      }

      case 'redirect_oauth': {
        const oauthHeaders = new Headers();
        for (const cookie of result.cookies) oauthHeaders.append('Set-Cookie', cookie);
        return NextResponse.redirect(result.redirectUrl, { headers: oauthHeaders });
      }

      case 'redirect_login': {
        return NextResponse.redirect(result.redirectUrl);
      }
    }
  };
}
