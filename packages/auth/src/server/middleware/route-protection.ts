import type { SessionData } from '../types';

/**
 * Checks if a given pathname should be protected (require authentication)
 *
 * @param pathname - URL pathname to check
 * @param skipRoutes - Array of route prefixes to skip protection
 * @returns true if route should be protected, false if it should be skipped
 */
export function shouldProtectRoute(pathname: string, skipRoutes: string[]): boolean {
  // Check if pathname starts with any of the skip routes
  return !skipRoutes.some((route) => pathname.startsWith(route));
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
  skipRoutes: string[],
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
