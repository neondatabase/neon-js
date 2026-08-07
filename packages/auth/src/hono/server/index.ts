import { createAuthServer } from '@/server';
import { createHonoRequestContext } from './adapter';
import type { NeonAuthConfig, NeonAuthMiddlewareConfig } from '@/server/config';
import { validateCookieConfig } from '@/server/config';
import { resolveNeonAuthLogging } from '@/server/logger';
import { honoAuthHandler } from './handler';
import { neonAuthHonoMiddleware } from './middleware';
import type { NeonAuthServer } from '@/server/types';

// Re-export the same observability + error-classification surface exposed by
// `@neondatabase/auth/next/server` so Hono adopters get a superset-compatible
// API surface across framework adapters.
export {
  resolveNeonAuthLogging,
  type NeonAuthLogger,
  type NeonAuthLogLevel,
  type NeonAuthLoggingInput,
  type ResolvedNeonAuthLogging,
} from '@/server/logger';
export {
  NEON_AUTH_NETWORK_ERROR_CODES,
  classifyFetchFailure,
  type NeonAuthNetworkErrorCode,
  type ClassifiedFetchFailure,
} from '@/server/network-error';
export type { NeonAuthServerApiError } from '@/server/types';

// Re-export the sub-primitives so Hono adopters can call them directly if
// they want to bypass the unified `createNeonAuth` factory.
export { honoAuthHandler } from './handler';
export { neonAuthHonoMiddleware } from './middleware';
export { createHonoRequestContext } from './adapter';

/**
 * Unified entry point for Neon Auth in Hono.
 *
 * Returns a single object that exposes:
 * - All Better Auth server methods (`signIn`, `signUp`, `getSession`, …)
 * - `.handler()` — a Hono handler for mounting at `/api/auth/*`
 * - `.middleware(opts?)` — a Hono middleware for route protection
 *
 * ## Requirements
 *
 * The app **MUST** register Hono's `contextStorage()` middleware once, at
 * the top of the chain — otherwise `auth.getSession()` (and every other
 * server method) cannot resolve the in-flight request:
 *
 * ```ts
 * import { contextStorage } from 'hono/context-storage';
 * app.use(contextStorage());
 * ```
 *
 * @param config - Required configuration
 * @param config.baseUrl - Base URL of your Neon Auth instance
 * @param config.cookies.secret - Signing secret (minimum 32 characters)
 * @param config.cookies.sessionDataTtl - Optional session-cache TTL (default: 300s)
 * @param config.cookies.domain - Optional cookie domain
 * @param config.cookies.sameSite - Optional cookie SameSite (default: `'lax'`)
 * @param config.logger - Optional structured logger
 * @param config.logLevel - Minimum log level (`'silent'` disables all output)
 * @returns Unified auth instance: server methods + `.handler()` + `.middleware()`
 * @throws Error if `cookies.secret` is less than 32 characters
 *
 * @example
 * ```ts
 * // src/auth.ts
 * import { createNeonAuth } from '@neondatabase/auth/hono/server';
 *
 * export const auth = createNeonAuth({
 *   baseUrl: process.env.NEON_AUTH_BASE_URL!,
 *   cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
 * });
 * ```
 *
 * @example
 * ```ts
 * // src/index.ts
 * import { Hono } from 'hono';
 * import { contextStorage } from 'hono/context-storage';
 * import { serve } from '@hono/node-server';
 * import { auth } from './auth';
 *
 * const app = new Hono();
 * app.use(contextStorage());
 * app.on(['GET', 'POST'], '/api/auth/*', auth.handler());
 * app.use('*', auth.middleware({ loginUrl: '/sign-in' }));
 *
 * app.get('/', async (c) => {
 *   const { data: session } = await auth.getSession();
 *   return c.text(session?.user ? `Hello ${session.user.name}` : 'Please sign in');
 * });
 *
 * serve({ fetch: app.fetch, port: 3000 });
 * ```
 */
export function createNeonAuth(config: NeonAuthConfig): NeonAuth {
  const { baseUrl, cookies } = config;

  validateCookieConfig(cookies);

  const log = resolveNeonAuthLogging(config);

  const server = createAuthServer({
    baseUrl,
    context: createHonoRequestContext,
    cookieSecret: cookies.secret,
    sessionDataTtl: cookies.sessionDataTtl,
    domain: cookies.domain,
    sameSite: cookies.sameSite,
    log,
  });

  // Attach handler/middleware directly to the Proxy-backed server object
  // (a spread would drop dynamic properties, matching the Next.js adapter).
  (server as NeonAuth).handler = () => honoAuthHandler(config);
  (server as NeonAuth).middleware = (
    middlewareConfig?: Pick<NeonAuthMiddlewareConfig, 'loginUrl'>
  ) => neonAuthHonoMiddleware({ ...config, ...middlewareConfig, log });

  return server as NeonAuth;
}

/**
 * Return type for {@link createNeonAuth}: the full Better Auth server surface
 * plus the Hono-native `.handler()` and `.middleware()` factories.
 */
export type NeonAuth = NeonAuthServer & {
  handler: () => ReturnType<typeof honoAuthHandler>;
  middleware: (
    middlewareConfig?: Pick<NeonAuthMiddlewareConfig, 'loginUrl'>
  ) => ReturnType<typeof neonAuthHonoMiddleware>;
};
