import { createAuthServerInternal } from '../../../server';
import { createTanStackStartRequestContext } from './adapter';
import { createAuthHandler } from './handler';
import type { ProtectRouteConfig } from './protect-route';
import { protectRoute } from './protect-route';
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
 * **Important:** TanStack Start's isomorphic execution model means all module-level
 * code runs on both client and server. The config callback is deferred — it is only
 * invoked server-side on first use, so `process.env` access for secrets is safe.
 *
 * @param getConfig - Callback returning NeonAuthConfig. Only called server-side on first use.
 * @param getConfig.baseUrl - Base URL of your Neon Auth instance
 * @param getConfig.cookies - Cookie configuration
 * @param getConfig.cookies.secret - Secret for signing session cookies (minimum 32 characters)
 * @param getConfig.cookies.sessionDataTtl - Optional TTL for session cache in seconds (default: 300)
 * @param getConfig.cookies.domain - Optional cookie domain (default: current domain)
 * @returns Unified auth instance with server methods, handler, and protectRoute
 * @throws Error if `cookies.secret` is less than 32 characters (on first use)
 *
 * @example
 * ```typescript
 * // lib/auth-server.ts - Create a singleton instance
 * import { createNeonAuth } from '@neondatabase/auth/tanstack/start/server';
 *
 * // Safe — callback deferred until server-side execution
 * export const auth = createNeonAuth(() => ({
 *   baseUrl: process.env.NEON_AUTH_BASE_URL!,
 *   cookies: {
 *     secret: process.env.NEON_AUTH_COOKIE_SECRET!,
 *     sessionDataTtl: 300, // 5 minutes (default)
 *   },
 * }));
 * ```
 *
 * @example
 * ```typescript
 * // routes/api/auth/$.ts - Auth API proxy route
 * import { createFileRoute } from '@tanstack/react-router';
 * import { auth } from '@/lib/auth-server';
 *
 * export const Route = createFileRoute('/api/auth/$')({
 *   server: {
 *     handlers: {
 *       GET: auth.handler(),
 *       POST: auth.handler(),
 *     },
 *   },
 * });
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
export function createNeonAuth(getConfig: () => NeonAuthConfig) {
	let resolvedConfig: NeonAuthConfig | null = null;
	let cachedServer: NeonAuthServer | null = null;

	function getValidatedConfig(): NeonAuthConfig {
		if (!resolvedConfig) {
			resolvedConfig = getConfig();
			validateCookieConfig(resolvedConfig.cookies);
		}
		return resolvedConfig;
	}

	function getServer(): NeonAuthServer {
		if (!cachedServer) {
			const config = getValidatedConfig();
			cachedServer = createAuthServerInternal({
				baseUrl: config.baseUrl,
				context: createTanStackStartRequestContext,
				cookieSecret: config.cookies.secret,
				sessionDataTtl: config.cookies.sessionDataTtl,
				domain: config.cookies.domain,
			});

			(cachedServer as NeonAuth).handler = () => createAuthHandler(config);

			(cachedServer as NeonAuth).protectRoute = (
				routeConfig: Pick<ProtectRouteConfig, 'loginUrl' | 'pathname'>
			) => protectRoute(config, routeConfig);
		}
		return cachedServer as NeonAuth;
	}

	// Return a proxy that defers server creation until first property access.
	// This keeps `process.env` reads out of module-level evaluation.
	return new Proxy({} as NeonAuth, {
		get(_target, prop) {
			if (typeof prop === 'symbol') return;
			const server = getServer();
			const value = (server as Record<string, unknown>)[prop];
			if (typeof value === 'function') return value.bind(server);
			return value;
		},
		has(_target, prop) {
			if (typeof prop === 'symbol') return false;
			const server = getServer();
			return prop in server;
		},
	});
}

/**
 * Return type for createNeonAuth
 * Includes all Better Auth server methods plus handler() and protectRoute()
 */
export type NeonAuth = NeonAuthServer & {
	handler: () => (request: Request, data: { path?: string }) => Promise<Response>;
	protectRoute: (
		config: Pick<ProtectRouteConfig, 'loginUrl' | 'pathname'>
	) => Promise<void>;
};

export type { NeonAuthConfig } from '../../../server/config';
export type { ProtectRouteConfig } from './protect-route';
