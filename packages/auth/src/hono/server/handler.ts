import type { Context } from 'hono';
import { handleAuthProxyRequest } from '@/server/proxy';
import type { NeonAuthConfig } from '@/server/config';
import { validateCookieConfig } from '@/server/config';
import { resolveNeonAuthLogging } from '@/server/logger';

/**
 * The prefix consumed by {@link honoAuthHandler}. Kept in one place so the
 * default mount path and the prefix-stripping logic can never drift apart.
 *
 * @internal
 */
const AUTH_MOUNT_PREFIX = '/api/auth/';

/**
 * A Hono handler that proxies auth requests to the upstream Neon Auth server.
 *
 * Mount this under `/api/auth/*` (or any prefix that ends in `/api/auth/`) —
 * the returned handler auto-strips its `/api/auth/` prefix from the incoming
 * path before forwarding.
 *
 * @param config - Required configuration
 * @param config.baseUrl - Base URL of your Neon Auth instance
 * @param config.cookies.secret - Signing secret (minimum 32 characters)
 * @param config.cookies.sessionDataTtl - Optional session-cache TTL in seconds (default: 300)
 * @param config.cookies.domain - Optional cookie domain
 * @param config.cookies.sameSite - Optional cookie SameSite (default: `'lax'`)
 * @param config.logger - Optional structured logger
 * @param config.logLevel - Minimum log level (`'silent'` disables all output)
 * @returns A Hono `Handler` — `async (c) => Response`.
 * @throws Error if `cookies.secret` is less than 32 characters
 *
 * @example
 * ```ts
 * import { Hono } from 'hono';
 * import { contextStorage } from 'hono/context-storage';
 * import { honoAuthHandler } from '@neondatabase/auth/hono/server';
 *
 * const app = new Hono();
 * app.use(contextStorage());
 * app.on(['GET', 'POST'], '/api/auth/*', honoAuthHandler({
 *   baseUrl: process.env.NEON_AUTH_BASE_URL!,
 *   cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
 * }));
 * ```
 */
export function honoAuthHandler(config: NeonAuthConfig) {
  const { baseUrl, cookies } = config;
  validateCookieConfig(cookies);
  const log = resolveNeonAuthLogging(config);

  return async (c: Context): Promise<Response> => {
    const url = new URL(c.req.url);
    // Strip the /api/auth/ mount prefix. The toolkit's proxy expects the
    // remainder joined with `/` (e.g. `sign-in/email`), NOT an array.
    const idx = url.pathname.indexOf(AUTH_MOUNT_PREFIX);
    const path = idx === -1
      ? url.pathname.replace(/^\/+/, '')
      : url.pathname.slice(idx + AUTH_MOUNT_PREFIX.length);

    return handleAuthProxyRequest({
      request: c.req.raw,
      path,
      baseUrl,
      cookieSecret: cookies.secret,
      sessionDataTtl: cookies.sessionDataTtl,
      domain: cookies.domain,
      sameSite: cookies.sameSite,
      log,
    });
  };
}
