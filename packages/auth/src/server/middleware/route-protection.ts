import type { SessionData } from '../types';

/**
 * Default list of route prefixes that {@link processAuthMiddleware} skips when
 * deciding whether to enforce authentication. Includes the auth API mount
 * (`/api/auth`) and the auth-ui pages added by `@neondatabase/auth-ui`.
 *
 * Framework adapters use this as the default for their middleware integrations.
 * Application authors can compose it with their own public routes:
 *
 * ```ts
 * import { DEFAULT_AUTH_SKIP_ROUTES } from '@neondatabase/auth/server';
 *
 * const SKIP_ROUTES = [...DEFAULT_AUTH_SKIP_ROUTES, '/marketing', '/healthz'];
 * ```
 *
 * @public
 */
export const DEFAULT_AUTH_SKIP_ROUTES = [
  '/api/auth',
  // Routes added by `@neondatabase/auth-ui`
  '/auth/callback',
  '/auth/sign-in',
  '/auth/sign-up',
  '/auth/magic-link',
  '/auth/email-otp',
  '/auth/forgot-password',
] as const;

/**
 * Checks if a given pathname should be protected (require authentication)
 *
 * @param pathname - URL pathname to check
 * @param skipRoutes - Array of route prefixes to skip protection
 * @returns true if route should be protected, false if it should be skipped
 */
export function shouldProtectRoute(pathname: string, skipRoutes: readonly string[]): boolean {
  // Segment-aware match: a skip route matches the pathname when the
  // pathname is exactly equal to it OR is a descendant (route + '/...').
  //
  // Bare `pathname.startsWith(route)` causes prefix bleed — e.g. with
  // `route = '/auth/sign-in'` it would also skip `/auth/sign-internal`,
  // and `/api/auth` would skip `/api/authz`. Since `DEFAULT_AUTH_SKIP_ROUTES`
  // is now an exported public toolkit contract, the bug would silently
  // expose adapter authors. See #161 review feedback (Andras).
  //
  // Trailing slashes on route definitions are normalized so that
  // `['/api/auth/']` behaves the same as `['/api/auth']`.
  return !skipRoutes.some((rawRoute) => {
    const route = rawRoute.endsWith('/') && rawRoute.length > 1
      ? rawRoute.slice(0, -1)
      : rawRoute;
    return pathname === route || pathname.startsWith(`${route}/`);
  });
}

/**
 * Result of session requirement check
 */
export interface SessionCheckResult {
  /** Whether the request is allowed to proceed */
  allowed: boolean;
  /** Session data if authenticated */
  session?: SessionData;
  /** Whether redirect is needed (only relevant if not allowed) */
  requiresRedirect: boolean;
}

/**
 * Checks if the current request requires a valid session
 * Returns result indicating if request should proceed, redirect, or continue
 *
 * @param pathname - URL pathname being accessed
 * @param skipRoutes - Routes that don't require authentication
 * @param loginUrl - URL to redirect to for login (if applicable)
 * @param session - Current session data (null if not authenticated)
 * @returns Session check result
 */
export function checkSessionRequired(
  pathname: string,
  skipRoutes: readonly string[],
  loginUrl: string,
  session: SessionData | null
): SessionCheckResult {
  // Always allow access to login URL to prevent infinite redirect
  if (pathname.startsWith(loginUrl)) {
    return { allowed: true, requiresRedirect: false };
  }

  // Check if route should be protected
  if (!shouldProtectRoute(pathname, skipRoutes)) {
    return { allowed: true, requiresRedirect: false };
  }

  // Route requires protection - check if session exists
  if (!session || session.session === null) {
    return { allowed: false, requiresRedirect: true };
  }

  // Valid session exists
  return { allowed: true, session, requiresRedirect: false };
}
