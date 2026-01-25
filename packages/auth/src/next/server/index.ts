import { createAuthServerInternal } from '@/server';
import { createNextRequestContext } from './adapter';
import type { NeonAuthConfig, NeonAuthMiddlewareConfig } from '@/server/config';
import { validateCookieSecret } from '@/server/config';
import { authApiHandler } from './handler';
import { neonAuthMiddleware } from './middleware';
import type { NeonAuthServer } from '@/server/types';

/**
 * Unified entry point for Neon Auth in Next.js
 *
 * This is the recommended way to use Neon Auth in Next.js. It provides a single
 * entry point that combines all server-side functionality.
 *
 * **Features:**
 * - All Better Auth server methods (signIn, signUp, getSession, etc.)
 * - `.handler()` - API route handler for `/api/auth/[...path]`
 * - `.middleware(config?)` - Middleware for route protection
 *
 * **Where to use:**
 * - React Server Components
 * - Server Actions
 * - Route Handlers
 * - Middleware
 *
 * @param config - Required configuration
 * @param config.baseUrl - Base URL of your Neon Auth instance
 * @param config.cookieSecret - Secret for signing session cookies (minimum 32 characters)
 * @returns Unified auth instance with server methods, handler, and middleware
 * @throws Error if `cookieSecret` is less than 32 characters
 *
 * @example
 * ```typescript
 * // lib/auth.ts - Create a singleton instance
 * import { createNeonAuth } from '@neondatabase/auth/next/server';
 *
 * export const auth = createNeonAuth({
 *   baseUrl: process.env.NEON_AUTH_BASE_URL!,
 *   cookieSecret: process.env.NEON_AUTH_COOKIE_SECRET!,
 * });
 * ```
 *
 * @example
 * ```typescript
 * // app/api/auth/[...path]/route.ts - API handler
 * import { auth } from '@/lib/auth';
 *
 * export const { GET, POST } = auth.handler();
 * ```
 *
 * @example
 * ```typescript
 * // middleware.ts - Route protection
 * import { auth } from '@/lib/auth';
 *
 * export default auth.middleware({ loginUrl: '/auth/sign-in' });
 *
 * export const config = {
 *   matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
 * };
 * ```
 *
 * @example
 * ```typescript
 * // app/page.tsx - Server Component
 * import { auth } from '@/lib/auth';
 *
 * export default async function Page() {
 *   const { data: session } = await auth.getSession();
 *   if (!session?.user) return <div>Not logged in</div>;
 *   return <div>Hello {session.user.name}</div>;
 * }
 * ```
 *
 * @example
 * ```typescript
 * // app/actions.ts - Server Action
 * 'use server';
 * import { auth } from '@/lib/auth';
 * import { redirect } from 'next/navigation';
 *
 * export async function signIn(formData: FormData) {
 *   const { error } = await auth.signIn.email({
 *     email: formData.get('email') as string,
 *     password: formData.get('password') as string,
 *   });
 *   if (error) return { error: error.message };
 *   redirect('/dashboard');
 * }
 * ```
 */
export function createNeonAuth(config: NeonAuthConfig) {
	const { baseUrl, cookieSecret } = config;

	validateCookieSecret(cookieSecret);

	// Create base server with all Better Auth methods
	const server = createAuthServerInternal({
		baseUrl,
		context: createNextRequestContext,
		cookieSecret,
	});

	return {
		...server,

		/**
		 * Creates API route handlers for Next.js
		 *
		 * Mount this in your API routes to handle auth requests:
		 * - `/api/auth/[...path]/route.ts`
		 *
		 * @returns Object with GET, POST, PUT, DELETE, PATCH handlers
		 *
		 * @example
		 * ```typescript
		 * // app/api/auth/[...path]/route.ts
		 * import { auth } from '@/lib/auth';
		 *
		 * export const { GET, POST } = auth.handler();
		 * ```
		 */
		handler: () => authApiHandler(config),

		/**
		 * Creates middleware for route protection
		 *
		 * Protects routes from unauthenticated access and handles:
		 * - Session validation and refresh
		 * - OAuth callback processing
		 * - Login redirects
		 *
		 * @param middlewareConfig - Optional middleware configuration
		 * @param middlewareConfig.loginUrl - URL to redirect to when not authenticated (default: '/auth/sign-in')
		 * @returns Middleware function for Next.js
		 *
		 * @example
		 * ```typescript
		 * // middleware.ts
		 * import { auth } from '@/lib/auth';
		 *
		 * export default auth.middleware({ loginUrl: '/auth/sign-in' });
		 *
		 * export const config = {
		 *   matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
		 * };
		 * ```
		 */
		middleware: (middlewareConfig?: Pick<NeonAuthMiddlewareConfig, 'loginUrl'>) =>
			neonAuthMiddleware({ ...config, ...middlewareConfig }),
	};
}

/**
 * Return type for createNeonAuth
 * Includes all Better Auth server methods plus handler() and middleware()
 */
export type NeonAuth = NeonAuthServer & {
	handler: () => ReturnType<typeof authApiHandler>;
	middleware: (
		middlewareConfig?: Pick<NeonAuthMiddlewareConfig, 'loginUrl'>
	) => ReturnType<typeof neonAuthMiddleware>;
};
