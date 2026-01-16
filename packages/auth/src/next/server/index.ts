import { createAuthServerInternal } from '../../server';
import { createNextRequestContext } from './adapter';
import { cookies } from 'next/headers';
import { validateSessionData } from '../../server/session';
import { NEON_AUTH_SESSION_DATA_COOKIE_NAME } from '../constants';

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
 * - `NEON_AUTH_BASE_URL` environment variable must be set
 * - Cookies are automatically read/written via `next/headers`
 * 
 * @returns Auth server API client for Next.js
 * @throws Error if `NEON_AUTH_BASE_URL` environment variable is not set
 * 
 * @example
 * ```typescript
 * // lib/auth/server.ts - Create a singleton instance
 * import { createAuthServer } from '@neondatabase/auth/next/server';
 * export const authServer = createAuthServer();
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
export function createAuthServer() {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  if (!baseUrl) {
    throw new Error(
      'NEON_AUTH_BASE_URL environment variable is required for createAuthServer()'
    );
  }

  const baseServer = createAuthServerInternal({
    baseUrl,
    context: createNextRequestContext,
  });

  // Override getSession with cookie-optimized version
  return {
    ...baseServer,

    async getSession(options?: Parameters<typeof baseServer.getSession>[0]) {
      // Check if cookie cache is disabled via query param
      const disableCookieCache = (options?.query as any)?.disableCookieCache === 'true';

      if (!disableCookieCache) {
        // Try cookie first (fast path)
        try {
          const cookieStore = await cookies();
          const sessionDataCookie = cookieStore.get(NEON_AUTH_SESSION_DATA_COOKIE_NAME);

          if (sessionDataCookie?.value) {
            const result = await validateSessionData(sessionDataCookie.value);

            if (result.valid && result.payload) {
              // Valid cookie - return immediately (0 upstream calls)
              return { data: result.payload, error: null };
            }
          }
        } catch (error) {
          // Cookie read/validation error - silently fall through to upstream
        }
      }

      // Fallback: Call upstream API
      return baseServer.getSession(options);
    },
  };
}
