import { createAuthServerInternal } from '../../server';
import { createNextRequestContext } from './adapter';

/**
 * Creates a server auth client for Next.js.
 *
 * This client can be used in:
 * - React Server Components
 * - Server Actions
 * - Route Handlers
 *
 * Cookies are automatically injected from `next/headers`.
 *
 * @example
 * ```typescript
 * // In a Server Component
 * import { createAuthServer } from '@neondatabase/auth/next/server';
 *
 * export default async function Page() {
 *   const auth = createAuthServer();
 *   const { data } = await auth.getSession();
 *
 *   if (!data?.session) {
 *     return <div>Not logged in</div>;
 *   }
 *
 *   return <div>Hello {data.user.name}</div>;
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

  return createAuthServerInternal({
    baseUrl,
    context: createNextRequestContext,
  });
}