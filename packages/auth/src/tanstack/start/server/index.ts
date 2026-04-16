import { createAuthServerInternal } from "@/server";
import type { NeonAuthConfig } from "@/server/config";
import { validateCookieConfig } from "@/server/config";
import type { NeonAuthServer } from "@/server/types";

import { createTanStackStartRequestContext } from "./adapter";
import { createHandlerFromConfig, type TanStackStartAuthHandler } from "./handler";
import { createMiddlewareFromServer, type TanStackStartAuthMiddleware } from "./middleware";
import { protectRoute, type ProtectRouteConfig } from "./protect-route";

/**
 * Unified entry point for Neon Auth in TanStack Start.
 *
 * This is the recommended way to use Neon Auth in TanStack Start. It provides
 * a single entry point that combines all server-side functionality.
 *
 * **Features:**
 * - `.handler` - Auth API proxy handler for catch-all `/api/auth/$` server route
 * - `.middleware` - Function-level middleware that injects `context.auth` with session data
 * - `.protectRoute()` - Route protection helper for `beforeLoad` hooks (redirects unauthenticated users)
 * - `.getSession()` - Direct session retrieval for use in server functions
 *
 * **Where to use:**
 * - Server functions (`createServerFn`)
 * - Server route handlers (`server.handlers`)
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
 * @returns Auth instance with handler, middleware, and server methods
 * @throws Error if `cookies.secret` is less than 32 characters
 *
 * @example
 * **Step 1: Create the auth instance**
 * ```typescript
 * // src/server/lib/auth.ts
 * import { createNeonAuth } from '@neondatabase/auth/tanstack/start/server';
 *
 * export const auth = createNeonAuth(() => ({
 *   baseUrl: process.env.NEON_AUTH_URL!,
 *   cookies: {
 *     secret: process.env.NEON_AUTH_COOKIE_SECRET!,
 *   },
 * }));
 * ```
 *
 * @example
 * **Step 2: Create the client auth**
 * ```typescript
 * // src/integrations/auth/client.ts
 * import { createAuthClient } from '@neondatabase/auth/tanstack/start';
 *
 * export const authClient = createAuthClient();
 * ```
 *
 * @example
 * **Step 3: Mount the auth API proxy route**
 *
 * This proxies auth requests from the client SDK to the Neon Auth server,
 * handling OAuth callbacks, session management, and cookie signing.
 * ```typescript
 * // src/routes/api/auth/$.ts
 * import { createFileRoute } from '@tanstack/react-router';
 * import { auth } from '@/server/lib/auth';
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
 * **Step 4: Protect server functions with auth middleware**
 *
 * The middleware validates the session and provides `context.auth`
 * with `{ user, session }` or `{ user: null, session: null }`.
 * ```typescript
 * import { createServerFn } from '@tanstack/react-start';
 * import { auth } from '@/server/lib/auth';
 *
 * const getUser = createServerFn()
 *   .middleware([auth.middleware()])
 *   .handler(async ({ context }) => {
 *     if (!context.auth.user) throw new Error('Not authenticated');
 *     return context.auth.user;
 *   });
 * ```
 *
 * @example
 * **Step 5: Protect routes from unauthenticated access**
 *
 * Use `protectRoute` in TanStack Router's `beforeLoad` hook to redirect
 * unauthenticated users. Works with layout routes for group protection.
 * ```typescript
 * // src/routes/_authed.tsx
 * import { createFileRoute } from '@tanstack/react-router';
 * import { auth } from '@/server/lib/auth';
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
 * **Direct session access (alternative to middleware)**
 * ```typescript
 * const checkSession = createServerFn().handler(async () => {
 *   const { data: session } = await auth.getSession();
 *   return session?.user ?? null;
 * });
 * ```
 */
export function createNeonAuth(getConfig: () => NeonAuthConfig) {
	let cachedConfig: NeonAuthConfig | null = null;
	let cachedServer: NeonAuth | null = null;

	function resolveConfig(): NeonAuthConfig {
		if (!cachedConfig) {
			const config = getConfig();
			validateCookieConfig(config.cookies);
			cachedConfig = config;
		}
		return cachedConfig;
	}

	// Built eagerly — createMiddleware() is a pure builder with no side effects.
	// The .server() callback defers getServer() to actual server-side execution.
	const middleware = createMiddlewareFromServer(getServer);

	function getServer(): NeonAuth {
		if (!cachedServer) {
			const config = resolveConfig();
			cachedServer = createAuthServerInternal({
				baseUrl: config.baseUrl,
				context: createTanStackStartRequestContext,
				cookieSecret: config.cookies.secret,
				sessionDataTtl: config.cookies.sessionDataTtl,
				domain: config.cookies.domain,
			}) as NeonAuth;

			cachedServer.handler = () => createHandlerFromConfig(config);
			cachedServer.middleware = () => middleware;
			cachedServer.protectRoute = (routeConfig: ProtectRouteConfig) =>
				protectRoute(config, routeConfig);
		}
		return cachedServer;
	}

	// Factory functions that are safe to access on the client.
	// TanStack Start evaluates createServerFn().middleware([auth.middleware()])
	// isomorphically — these must NOT trigger getServer() or config resolution.
	const clientSafeProps: Record<string, unknown> = {
		middleware: () => middleware,
		handler: () => createHandlerFromConfig(resolveConfig()),
	};

	return new Proxy({} as NeonAuth, {
		get(_target, prop: string) {
			if (prop in clientSafeProps) return clientSafeProps[prop];

			const server = getServer();
			const value = (server as Record<string, unknown>)[prop];
			if (typeof value === "function") return value.bind(server);
			return value;
		},
		has(_target, prop) {
			if (typeof prop === "symbol") return false;
			if (prop in clientSafeProps) return true;
			const server = getServer();
			return prop in server;
		},
	});
}

export type NeonAuth = NeonAuthServer & {
	handler: () => TanStackStartAuthHandler;
	middleware: () => TanStackStartAuthMiddleware;
	protectRoute: (config: ProtectRouteConfig) => Promise<void>;
};

