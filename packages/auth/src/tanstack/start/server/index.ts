import "@tanstack/react-start/server-only";

import type { NeonAuthConfig } from "@/server/config";
import type { NeonAuthServer } from "@/server/types";
import type { ProtectRouteConfig } from "./protect-route";
import type { TanStackStartAuthHandler } from "./handler";
import type { TanStackStartAuthMiddleware } from "./middleware";

import { createAuthServerInternal } from "@/server";
import { validateCookieConfig } from "@/server/config";
import { createTanStackStartRequestContext } from "./adapter";
import { createHandlerFromConfig } from "./handler";
import { createMiddlewareFromServer } from "./middleware";
import { protectRoute } from "./protect-route";

/** @internal Creates the auth server from resolved config. Exported for testing. */
export function createNeonAuthServer(config: NeonAuthConfig): NeonAuth {
	validateCookieConfig(config.cookies);

	const server = createAuthServerInternal({
		baseUrl: config.baseUrl,
		context: createTanStackStartRequestContext,
		cookieSecret: config.cookies.secret,
		sessionDataTtl: config.cookies.sessionDataTtl,
		domain: config.cookies.domain,
	}) as NeonAuth;

	const middleware = createMiddlewareFromServer(() => server);

	server.handler = () => createHandlerFromConfig(config);
	server.middleware = () => middleware;
	server.protectRoute = (routeConfig: ProtectRouteConfig) =>
		protectRoute(config, routeConfig);

	return server;
}

/**
 * Unified entry point for Neon Auth in TanStack Start.
 *
 * This is the recommended way to use Neon Auth in TanStack Start. It provides
 * a single entry point that combines all server-side functionality.
 *
 * **Features:**
 * - `.handler()` - Auth API proxy handler for catch-all `/api/auth/$` server route
 * - `.middleware()` - Function-level middleware that injects `context.auth` with session data
 * - `.protectRoute()` - Route protection helper for `beforeLoad` hooks (redirects unauthenticated users)
 * - `.getSession()` - Direct session retrieval for use in server functions
 *
 * **Where to use:**
 * - Server functions (`createServerFn`)
 * - Server route handlers (`server.handlers`)
 *
 * **Server-only:** This module is guarded by `@tanstack/react-start/server-only`
 * and must not be imported from client code. Server functions that use
 * `auth.middleware()` are safe to call from the client because TanStack Start's
 * Vite plugin transforms them into RPC stubs — but they must be imported
 * directly from their file, not through a barrel/index re-export.
 *
 * @param getConfig - Callback returning {@link NeonAuthConfig}. Using a callback
 *   defers `process.env` reads past the `createNeonAuth()` call site, which is
 *   necessary in Vite's dev server where env vars may not be populated yet at
 *   the point the import is declared.
 * @returns Auth instance with handler, middleware, and server methods
 * @throws Error if `cookies.secret` is missing or less than 32 characters
 *
 * @example
 * **Step 1: Create the auth instance**
 * ```typescript
 * // src/server/lib/auth.ts
 * import '@tanstack/react-start/server-only';
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

export function createNeonAuth(getConfig: () => NeonAuthConfig): NeonAuth {
	return createNeonAuthServer(getConfig());
}

export type NeonAuth = NeonAuthServer & {
	handler: () => TanStackStartAuthHandler;
	middleware: () => TanStackStartAuthMiddleware;
	protectRoute: (config: ProtectRouteConfig) => Promise<void>;
};
