import type { Context } from 'hono';
import { getContext } from 'hono/context-storage';
import { setCookie } from 'hono/cookie';
import type { RequestContext } from '../../server';

/**
 * Creates a Hono-specific {@link RequestContext} bound to the in-flight
 * request via Hono's built-in `hono/context-storage`.
 *
 * The app **MUST** register the `contextStorage()` middleware once (usually
 * at the very top of its middleware chain) so that `getContext()` can resolve
 * inside {@link createAuthServer}'s server-method invocations
 * (`auth.getSession()`, `auth.signIn.email(...)`, etc.), which run outside
 * the direct handler scope.
 *
 * @example
 * ```ts
 * import { Hono } from 'hono';
 * import { contextStorage } from 'hono/context-storage';
 * import { createNeonAuth } from '@neondatabase/auth/hono/server';
 *
 * const app = new Hono();
 * app.use(contextStorage());
 *
 * const auth = createNeonAuth({
 *   baseUrl: process.env.NEON_AUTH_BASE_URL!,
 *   cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
 * });
 *
 * app.on(['GET', 'POST'], '/api/auth/*', auth.handler());
 * // Scope `auth.middleware()` to just the paths that need protection.
 * app.use('/dashboard', auth.middleware({ loginUrl: '/sign-in' }));
 * ```
 */
export function createHonoRequestContext(): RequestContext {
  const c = getContext<{ Variables: Record<string, unknown> }>();
  return honoRequestContextFromContext(c);
}

/**
 * Internal helper that constructs a {@link RequestContext} from an explicit
 * Hono `Context`. Exposed to the test suite so unit tests can supply a
 * synthesized `Context` directly, without running inside `contextStorage()`.
 *
 * Not part of the public export surface — do not depend on this from adapter
 * consumer code; use {@link createHonoRequestContext} instead.
 *
 * @internal
 */
export function honoRequestContextFromContext(c: Context): RequestContext {
  return {
    getCookies() {
      return c.req.header('cookie') ?? '';
    },
    setCookie(name, value, options) {
      // Hono's `setCookie` helper takes camelCase attribute names that align
      // with the toolkit's `CookieOptions` shape (`maxAge`, `httpOnly`,
      // `sameSite`, `partitioned`, etc.). Passing options through verbatim is
      // safe; the toolkit sanitizes upstream cookie flags before this point.
      setCookie(c, name, value, options);
    },
    getHeader(name) {
      return c.req.header(name) ?? null;
    },
    getOrigin() {
      return (
        c.req.header('origin') ||
        c.req.header('referer')?.split('/').slice(0, 3).join('/') ||
        ''
      );
    },
    getFramework() {
      return 'hono';
    },
  };
}
