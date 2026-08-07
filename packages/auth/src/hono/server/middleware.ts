import type { Context, MiddlewareHandler } from 'hono';
import { DEFAULT_AUTH_SKIP_ROUTES, processAuthMiddleware } from '@/server/middleware';
import type { NeonAuthMiddlewareConfig } from '@/server/config';
import { validateCookieConfig } from '@/server/config';

/**
 * A Hono middleware that protects routes from unauthenticated requests,
 * transparently refreshes stale sessions, and finalizes OAuth callbacks.
 *
 * The middleware runs on every request and:
 * - `allow`s public routes (see `DEFAULT_AUTH_SKIP_ROUTES`) and authenticated
 *   requests to protected routes, appending any minted session-cache cookies;
 * - `redirect_oauth` finalizes an OAuth `?code=` callback, clears the
 *   verifier cookie, and 302-redirects to the intended target;
 * - `redirect_login` 302-redirects unauthenticated requests to `loginUrl`,
 *   clearing any stale cookies.
 *
 * @param config - Middleware configuration
 * @param config.baseUrl - Base URL of your Neon Auth instance
 * @param config.cookies.secret - Signing secret (minimum 32 characters)
 * @param config.cookies.sessionDataTtl - Optional session-cache TTL in seconds (default: 300)
 * @param config.cookies.domain - Optional cookie domain
 * @param config.cookies.sameSite - Optional cookie SameSite (default: `'lax'`)
 * @param config.loginUrl - URL to redirect unauthenticated users to (default: `'/auth/sign-in'`)
 * @param config.logger - Optional structured logger
 * @param config.logLevel - Minimum log level (`'silent'` disables all output)
 * @returns A Hono `MiddlewareHandler`.
 * @throws Error if `cookies.secret` is less than 32 characters
 *
 * @example
 * ```ts
 * import { Hono } from 'hono';
 * import { contextStorage } from 'hono/context-storage';
 * import { neonAuthHonoMiddleware } from '@neondatabase/auth/hono/server';
 *
 * const app = new Hono();
 * app.use(contextStorage());
 * app.use('*', neonAuthHonoMiddleware({
 *   baseUrl: process.env.NEON_AUTH_BASE_URL!,
 *   cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
 *   loginUrl: '/sign-in',
 * }));
 * ```
 */
export function neonAuthHonoMiddleware(
  config: NeonAuthMiddlewareConfig
): MiddlewareHandler {
  const {
    baseUrl,
    cookies,
    loginUrl = '/auth/sign-in',
    log,
    logger,
    logLevel,
  } = config;

  validateCookieConfig(cookies);

  return async (c: Context, next) => {
    const url = new URL(c.req.url);

    const result = await processAuthMiddleware({
      request: c.req.raw,
      pathname: url.pathname,
      skipRoutes: DEFAULT_AUTH_SKIP_ROUTES,
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
        // Forward signal headers (e.g. `x-neon-auth-middleware: true`) onto
        // the incoming request so downstream handlers see them. Mutating
        // `c.req.raw.headers` directly is safe here — Hono treats the raw
        // Fetch `Request` as opaque and re-reads headers by name.
        if (result.headers) {
          for (const [key, value] of Object.entries(result.headers)) {
            c.req.raw.headers.set(key, value);
          }
        }
        await next();
        // Append minted session-cache cookies to the downstream response,
        // never overwriting cookies the route handler itself may have set.
        if (result.cookies) {
          for (const cookie of result.cookies) {
            c.res.headers.append('set-cookie', cookie);
          }
        }
        return;
      }

      case 'redirect_oauth': {
        // Verifier-cleanup cookies MUST land on the redirect response, or
        // the OAuth callback will loop.
        const headers = new Headers();
        for (const cookie of result.cookies) headers.append('set-cookie', cookie);
        headers.set('location', result.redirectUrl.toString());
        return new Response(null, { status: 302, headers });
      }

      case 'redirect_login': {
        const headers = new Headers();
        if (result.cookies && result.cookies.length > 0) {
          for (const cookie of result.cookies) headers.append('set-cookie', cookie);
        }
        headers.set('location', result.redirectUrl.toString());
        return new Response(null, { status: 302, headers });
      }
    }
  };
}
