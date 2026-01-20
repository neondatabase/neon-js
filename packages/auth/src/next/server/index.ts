import { createAuthServerInternal } from '@/server';
import { createNextRequestContext } from './adapter';
import { cookies } from 'next/headers';
import { validateSessionData } from '@/server/session';
import { NEON_AUTH_SESSION_DATA_COOKIE_NAME } from '../constants';
import { assertDefined } from '@/server/session/validator';
import { ERRORS } from '@/server/errors';

// Re-export server-side utilities
export { neonAuth } from '../auth';
export { neonAuthMiddleware } from '../middleware';
export { authApiHandler } from '../handler';

/**
 * Creates a server-side auth API client for Next.js.
 *
 * This client exposes the Neon Auth APIs including authentication, user management, organizations, and admin operations.
 *
 * **Where to use:**
 * - React Server Components
 * - Server Actions
 * - Route Handlers
 *
 * **Requirements:**
 * - `NEON_AUTH_BASE_URL` environment variable must be set (or passed in config)
 * - Cookies are automatically read/written via `next/headers`
 *
 * @param config - Optional configuration (falls back to environment variables)
 * @param config.baseUrl - Optional base URL (falls back to NEON_AUTH_BASE_URL env var)
 * @param config.cookieSecret - Optional cookie secret (falls back to NEON_AUTH_COOKIE_SECRET env var)
 * @returns Auth server API client for Next.js
 * @throws Error if `NEON_AUTH_BASE_URL` environment variable is not set and not provided in config
 *
 * @example
 * ```typescript
 * // lib/auth/server.ts - Create a singleton instance
 * import { createAuthServer } from '@neondatabase/auth/next/server';
 *
 * // Uses environment variables (backward compatible)
 * export const authServer = createAuthServer();
 *
 * // Or with explicit config
 * export const authServer = createAuthServer({
 *   baseUrl: 'https://auth.example.com',
 *   cookieSecret: process.env.SECRET
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Server Component - Reading session
 * import { authServer } from '@/lib/auth/server';
 *
 * export default async function Page() {
 *   const { data: session } = await authServer.getSession();
 *   if (!session?.user) return <div>Not logged in</div>;
 *   return <div>Hello {session.user.name}</div>;
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Server Action - Sign in
 * 'use server';
 * import { authServer } from '@/lib/auth/server';
 * import { redirect } from 'next/navigation';
 *
 * export async function signIn(formData: FormData) {
 *   const { error } = await authServer.signIn.email({
 *     email: formData.get('email') as string,
 *     password: formData.get('password') as string,
 *   });
 *   if (error) return { error: error.message };
 *   redirect('/dashboard');
 * }
 * ```
 */
export function createAuthServer(config?: {
  baseUrl?: string;
  cookieSecret?: string;
}) {
  const baseUrl = config?.baseUrl ?? process.env.NEON_AUTH_BASE_URL;
  const cookieSecret = config?.cookieSecret ?? process.env.NEON_AUTH_COOKIE_SECRET;

  assertDefined(baseUrl, new Error(ERRORS.MISSING_AUTH_BASE_URL));

  const baseServer = createAuthServerInternal({
    baseUrl,
    context: createNextRequestContext,
  });

  // Override getSession with cookie-optimized version
  return {
    ...baseServer,

    async getSession(options?: Parameters<typeof baseServer.getSession>[0]) {
      // Backward compatibility: if secret not configured, use original behavior
      if (!cookieSecret) {
        return baseServer.getSession(options);
      }

      // Check if cookie cache is disabled via query param
      const disableCookieCache = options?.query?.disableCookieCache === 'true';
      if (disableCookieCache) {
        return baseServer.getSession(options);
      }

      // Try cookie cache first
      try {
        const cookieStore = await cookies();
        const sessionDataCookie = cookieStore.get(NEON_AUTH_SESSION_DATA_COOKIE_NAME);

        if (sessionDataCookie?.value) {
          const result = await validateSessionData(sessionDataCookie.value, cookieSecret);

          if (result.valid && result.payload) {
            // Cache hit - return immediately
            return { data: result.payload, error: null };
          } else if (result.error) {
            // Cache miss - invalid cookie
            console.debug('[createAuthServer.getSession] Invalid session cookie:', {
              error: result.error,
            });
          }
        }
      } catch (error) {
        // Cookie read/validation error - log and fall through
        console.error('[createAuthServer.getSession] Cookie validation error:', {
          error: error instanceof Error ? error.message : String(error),
          hasSecret: !!cookieSecret,
        });
      }

      // Fallback: Call upstream API
      return baseServer.getSession(options);
    },
  };
}
