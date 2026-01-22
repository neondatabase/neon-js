import { createAuthServerInternal } from '@/server';
import { createNextRequestContext } from './adapter';
import type { NeonAuthConfig } from '@/server/config';
import { validateCookieSecret } from '@/server/config';

export { neonAuth } from './neon-auth';
export { neonAuthMiddleware } from './middleware';
export { authApiHandler } from './handler';

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
 * - `baseUrl` - Base URL of your Neon Auth instance
 * - `cookieSecret` - Secret for signing session cookies (at least 32 characters)
 * - Cookies are automatically read/written via `next/headers`
 *
 * @param config - Required configuration
 * @param config.baseUrl - Base URL of your Neon Auth instance
 * @param config.cookieSecret - Secret for signing session cookies (minimum 32 characters)
 * @returns Auth server API client for Next.js
 * @throws Error if `cookieSecret` is less than 32 characters
 *
 * @example
 * ```typescript
 * // lib/auth/server.ts - Create a singleton instance
 * import { createAuthServer } from '@neondatabase/auth/next/server';
 *
 * export const authServer = createAuthServer({
 *   baseUrl: process.env.NEON_AUTH_BASE_URL!,
 *   cookieSecret: process.env.NEON_AUTH_COOKIE_SECRET!,
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
export function createAuthServer(config: NeonAuthConfig) {
  const { baseUrl, cookieSecret } = config;

  validateCookieSecret(cookieSecret);

  // Create base server with cookie caching enabled
  return createAuthServerInternal({
    baseUrl,
    context: createNextRequestContext,
    cookieSecret,
  });
}
