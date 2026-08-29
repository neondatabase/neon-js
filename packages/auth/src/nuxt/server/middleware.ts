import {
  appendResponseHeader,
  defineEventHandler,
  sendRedirect,
  type H3Event,
} from 'h3';
import { NEON_AUTH_SESSION_VERIFIER_PARAM_NAME } from '../../core/constants';
import {
  DEFAULT_AUTH_SKIP_ROUTES,
  processAuthMiddleware,
  type MiddlewareResult,
  type ResolvedNeonAuthLogging,
  type SessionCookieSameSite,
} from '../../server';
import { createFetchRequest } from './handler';

const DEFAULT_PROTECTED_ROUTES: readonly string[] = [];

export interface NuxtAuthMiddlewareOptions {
  /**
   * URL to redirect unauthenticated users to.
   * @default '/auth/sign-in'
   */
  loginUrl?: string;
  /**
   * Slash-delimited route prefixes that require authentication.
   * @default []
   */
  protectedRoutes?: readonly string[];
}

export interface NuxtAuthMiddlewareConfig extends NuxtAuthMiddlewareOptions {
  baseUrl: string;
  cookieSecret: string;
  sessionDataTtl?: number;
  domain?: string;
  sameSite?: SessionCookieSameSite;
  log?: ResolvedNeonAuthLogging;
}

function isSameRouteOrSubpath(pathname: string, prefix: string): boolean {
  const normalizedPrefix =
    prefix === '/' ? prefix : prefix.replace(/\/+$/, '');

  if (normalizedPrefix === '/') return pathname.startsWith('/');

  return (
    pathname === normalizedPrefix ||
    pathname.startsWith(`${normalizedPrefix}/`)
  );
}

/**
 * Returns whether a pathname matches one of the configured protected prefixes.
 */
export function matchesProtectedRoute(
  pathname: string,
  protectedRoutes: readonly string[]
): boolean {
  return protectedRoutes.some((route) =>
    isSameRouteOrSubpath(pathname, route)
  );
}

function appendCookies(event: H3Event, cookies: readonly string[] | undefined) {
  for (const cookie of cookies ?? []) {
    appendResponseHeader(event, 'set-cookie', cookie);
  }
}

/**
 * Maps every framework-agnostic middleware result to H3.
 */
export async function applyMiddlewareResult(
  event: H3Event,
  result: MiddlewareResult
): Promise<void> {
  switch (result.action) {
    case 'allow': {
      if (result.headers) {
        for (const [name, value] of Object.entries(result.headers)) {
          event.node.req.headers[name.toLowerCase()] = value;
          event.headers.set(name, value);
        }
      }
      appendCookies(event, result.cookies);
      return;
    }

    case 'redirect_oauth': {
      appendCookies(event, result.cookies);
      await sendRedirect(event, result.redirectUrl.toString(), 302);
      return;
    }

    case 'redirect_login': {
      appendCookies(event, result.cookies);
      await sendRedirect(event, result.redirectUrl.toString(), 302);
      return;
    }
  }
}

/**
 * Creates a Nitro middleware for route protection and OAuth finalization.
 */
export function neonAuthMiddleware(config: NuxtAuthMiddlewareConfig) {
  const {
    loginUrl = '/auth/sign-in',
    protectedRoutes = DEFAULT_PROTECTED_ROUTES,
  } = config;

  return defineEventHandler(async (event) => {
    const request = await createFetchRequest(event, false);
    const requestUrl = new URL(request.url);
    const routeIsProtected = matchesProtectedRoute(
      requestUrl.pathname,
      protectedRoutes
    );
    const hasOAuthVerifier = requestUrl.searchParams.has(
      NEON_AUTH_SESSION_VERIFIER_PARAM_NAME
    );

    // Public routes avoid session work, but verifier callbacks must always be
    // offered to the OAuth exchange path regardless of route protection.
    if (!routeIsProtected && !hasOAuthVerifier) return;

    const skipRoutes = routeIsProtected
      ? DEFAULT_AUTH_SKIP_ROUTES
      : [...DEFAULT_AUTH_SKIP_ROUTES, requestUrl.pathname];

    const result = await processAuthMiddleware({
      request,
      pathname: requestUrl.pathname,
      skipRoutes,
      loginUrl,
      baseUrl: config.baseUrl,
      cookieSecret: config.cookieSecret,
      sessionDataTtl: config.sessionDataTtl,
      domain: config.domain,
      sameSite: config.sameSite,
      log: config.log,
    });

    return applyMiddlewareResult(event, result);
  });
}
