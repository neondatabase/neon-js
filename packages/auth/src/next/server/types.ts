/**
 * Configuration types for unified Neon Auth API
 */

/**
 * Configuration for createNeonAuth()
 */
export interface NeonAuthConfig {
  /**
   * Base URL for the Neon Auth server
   *
   * @example 'https://auth.example.com'
   */
  baseUrl: string;

  /**
   * Secret for signing session data cookies (optional)
   *
   * Required for session caching. Must be at least 32 characters.
   * If not provided, session caching is disabled and all requests hit the Auth API.
   *
   * @example process.env.NEON_AUTH_COOKIE_SECRET
   */
  cookieSecret?: string;
}

/**
 * Internal context passed to auth functions
 *
 * @internal
 */
export interface NeonAuthContext {
  baseUrl: string;
  cookieSecret: string | undefined;
  isSessionCacheEnabled: () => boolean;
}

/**
 * Options for neonAuthMiddleware
 */
export interface NeonAuthMiddlewareOptions {
  /**
   * URL to redirect to when user is not authenticated
   *
   * @default '/api/auth/sign-in'
   */
  loginUrl?: string;
}
