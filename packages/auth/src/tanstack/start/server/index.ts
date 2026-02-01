import { createAuthServerInternal } from '../../../server';
import { createTanStackStartRequestContext } from './adapter';
import { createAuthHandler } from './handler';
import { protectRoute, type ProtectRouteConfig } from './protect-route';
import type { NeonAuthConfig } from '../../../server/config';
import { validateCookieConfig } from '../../../server/config';
import type { NeonAuthServer } from '../../../server/types';

/**
 * Unified entry point for Neon Auth in TanStack Start
 *
 * This is the recommended way to use Neon Auth in TanStack Start. It provides a single
 * entry point that combines all server-side functionality.
 *
 * **Features:**
 * - All Better Auth server methods (signIn, signUp, getSession, etc.)
 * - `.handler()` - Server function handler for auth API routes
 * - `.protectRoute(config)` - Helper for route protection in `beforeLoad`
 *
 * **Where to use:**
 * - Server Functions
 * - Route Loaders
 * - `beforeLoad` hooks
 *
 * @param config - Required configuration
 * @param config.baseUrl - Base URL of your Neon Auth instance
 * @param config.cookies - Cookie configuration
 * @param config.cookies.secret - Secret for signing session cookies (minimum 32 characters)
 * @param config.cookies.sessionDataTtl - Optional TTL for session cache in seconds (default: 300)
 * @param config.cookies.domain - Optional cookie domain (default: current domain)
 * @returns Unified auth instance with server methods, handler, and protectRoute
 * @throws Error if `cookies.secret` is less than 32 characters
 *
 * @example
 * ```typescript
 * // lib/auth-server.ts - Create a singleton instance
 * import { createNeonAuth } from '@neondatabase/auth/tanstack/start/server';
 *
 * export const auth = createNeonAuth({
 *   baseUrl: process.env.NEON_AUTH_BASE_URL!,
 *   cookies: {
 *     secret: process.env.NEON_AUTH_COOKIE_SECRET!,
 *     sessionDataTtl: 300, // 5 minutes (default)
 *   },
 * });
 * ```
 *
 * @example
 * ```typescript
 * // app/api.ts - Export server functions for client access
 * import { createServerFn } from '@tanstack/start';
 * import { auth } from './lib/auth-server';
 *
 * // Export auth handler as server function
 * export const authHandler = createServerFn({ method: 'POST' })
 *   .handler(auth.handler());
 *
 * // Export other auth methods as needed
 * export const getSession = createServerFn({ method: 'GET' })
 *   .handler(() => auth.getSession());
 * ```
 *
 * @example
 * ```typescript
 * // routes/_authed.tsx - Route protection
 * import { createFileRoute } from '@tanstack/react-router';
 * import { auth } from '@/lib/auth-server';
 *
 * export const Route = createFileRoute('/_authed')({
 *   beforeLoad: async ({ location }) => {
 *     await auth.protectRoute({
 *       pathname: location.pathname,
 *       loginUrl: '/auth/sign-in',
 *     });
 *   },
 * });
 * ```
 *
 * @example
 * ```typescript
 * // routes/dashboard.tsx - Using auth in loader
 * import { createFileRoute } from '@tanstack/react-router';
 * import { auth } from '@/lib/auth-server';
 *
 * export const Route = createFileRoute('/dashboard')({
 *   loader: async () => {
 *     const { data: session } = await auth.getSession();
 *     if (!session?.user) {
 *       throw redirect({ to: '/auth/sign-in' });
 *     }
 *     return { user: session.user };
 *   },
 *   component: Dashboard,
 * });
 *
 * function Dashboard() {
 *   const { user } = Route.useLoaderData();
 *   return <div>Hello {user.name}</div>;
 * }
 * ```
 */
export function createNeonAuth(config: NeonAuthConfig) {
	const { baseUrl, cookies } = config;

	validateCookieConfig(cookies);

	// Create base server with all Better Auth methods using proxy pattern
	// This gives us all methods (signIn, signOut, getSession, etc.) automatically
	const server = createAuthServerInternal({
		baseUrl,
		context: createTanStackStartRequestContext,
		cookieSecret: cookies.secret,
		sessionDataTtl: cookies.sessionDataTtl,
		domain: cookies.domain,
	});

	// Attach TanStack Start-specific helpers to the server proxy object
	/**
	 * Creates an auth API handler function for TanStack Start server functions
	 *
	 * This returns a handler function that should be wrapped with `createServerFn()`
	 * and exported from your API file.
	 *
	 * @returns Handler function for use with createServerFn()
	 *
	 * @example
	 * ```typescript
 * // app/api.ts
	 * import { createServerFn } from '@tanstack/start';
	 * import { auth } from '@/lib/auth-server';
	 *
	 * export const authHandler = createServerFn({ method: 'POST' })
	 *   .handler(auth.handler());
	 * ```
	 */
	(server as NeonAuth).handler = () => createAuthHandler(config);

	/**
	 * Protects a route from unauthenticated access
	 *
	 * Use this in TanStack Router's `beforeLoad` hook to validate session.
	 * Throws redirect() if authentication fails.
	 *
	 * @param routeConfig - Route protection configuration
	 * @param routeConfig.pathname - Current pathname being accessed
	 * @param routeConfig.loginUrl - URL to redirect to when not authenticated (default: '/auth/sign-in')
	 * @returns Promise that resolves if access is allowed
	 * @throws redirect() - Throws TanStack Router redirect if authentication fails
	 *
	 * @example
	 * ```typescript
	 * // routes/_authed.tsx
	 * export const Route = createFileRoute('/_authed')({
	 *   beforeLoad: async ({ location }) => {
	 *     await auth.protectRoute({
	 *       pathname: location.pathname,
	 *       loginUrl: '/auth/sign-in',
	 *     });
	 *   },
	 * });
	 * ```
	 */
	(server as NeonAuth).protectRoute = (
		routeConfig: Pick<ProtectRouteConfig, 'loginUrl' | 'pathname'>
	) => protectRoute(config, routeConfig);

	return server as NeonAuth;
}

/**
 * Return type for createNeonAuth
 * Includes all Better Auth server methods plus handler() and protectRoute()
 */
export type NeonAuth = NeonAuthServer & {
	handler: () => ReturnType<typeof createAuthHandler>;
	protectRoute: (
		config: Pick<ProtectRouteConfig, 'loginUrl' | 'pathname'>
	) => ReturnType<typeof protectRoute>;
};

// Re-export types for convenience
export type { NeonAuthConfig, ProtectRouteConfig };
