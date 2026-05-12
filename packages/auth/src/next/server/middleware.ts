import { NextRequest, NextResponse } from 'next/server';
import { processAuthMiddleware } from '@/server/middleware';
import type { NeonAuthMiddlewareConfig } from '@/server/config';
import { validateCookieConfig } from '@/server/config';

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
 * @param config.cookies - Cookie configuration
 * @param config.cookies.secret - Secret for signing session cookies (minimum 32 characters)
 * @param config.cookies.sessionDataTtl - Optional TTL for session cache in seconds (default: 300)
 * @param config.logger - Optional structured logger; omitted methods fall back to `console`
 * @param config.logLevel - Minimum log level; `'silent'` disables Neon Auth console output (default: `warn`)
 * @param config.log - Pre-resolved logging sink (set by {@link createNeonAuth})
 * @param config.loginUrl - The URL to redirect to when the user is not authenticated (default: '/auth/sign-in')
 * @returns A middleware function that can be used in the Next.js app.
 * @throws Error if `cookies.secret` is less than 32 characters
 *
 * @example
 * ```ts
 * import { neonAuthMiddleware } from "@neondatabase/auth/next"
 *
 * export default neonAuthMiddleware({
 *   baseUrl: process.env.NEON_AUTH_BASE_URL!,
 *   cookies: {
 *     secret: process.env.NEON_AUTH_COOKIE_SECRET!,
 *   },
 *   loginUrl: '/auth/sign-in',
 * });
 * ```
 */
export function neonAuthMiddleware(config: NeonAuthMiddlewareConfig) {
  const {
    baseUrl,
    cookies,
    loginUrl = '/auth/sign-in',
    log,
    logger,
    logLevel,
  } = config;

  validateCookieConfig(cookies);
  return async (request: NextRequest) => {
    const pathname = request.nextUrl.pathname;

    const result = await processAuthMiddleware({
      request,
      pathname,
      skipRoutes: SKIP_ROUTES,
      loginUrl,
      baseUrl,
      cookieSecret: cookies.secret,
      sessionDataTtl: cookies.sessionDataTtl,
      domain: cookies.domain,
      sameSite: cookies.sameSite,
      log,
      logger,
      logLevel,
    });

    switch (result.action) {
      case 'allow': {
        const headers = new Headers(request.headers);
        if (result.headers) {
          for (const [key, value] of Object.entries(result.headers)) {
            headers.set(key, value);
          }
        }

        const response = NextResponse.next({ request: { headers } });
        if (result.cookies) {
          for (const cookie of result.cookies) {
            response.headers.append('Set-Cookie', cookie);
          }
        }

        return response;
      }

      case 'redirect_oauth': {
        const oauthHeaders = new Headers();
        for (const cookie of result.cookies) oauthHeaders.append('Set-Cookie', cookie);
        return NextResponse.redirect(result.redirectUrl, { headers: oauthHeaders });
      }

      case 'redirect_login': {
        // Clear stale cookies if present
        if (result.cookies && result.cookies.length > 0) {
          const loginHeaders = new Headers();
          for (const cookie of result.cookies) loginHeaders.append('Set-Cookie', cookie);
          return NextResponse.redirect(result.redirectUrl, { headers: loginHeaders });
        }
        return NextResponse.redirect(result.redirectUrl);
      }
    }
  };
}
