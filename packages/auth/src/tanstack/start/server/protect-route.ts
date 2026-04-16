import type { NeonAuthConfig } from "@/server/config";

import { processAuthMiddleware } from "@/server/middleware";

export interface ProtectRouteConfig {
	/** URL to redirect to when user is not authenticated (default: '/auth/sign-in') */
	loginUrl?: string;
	/** Current pathname being accessed */
	pathname: string;
}

const AUTH_API_ROUTES = "/api/auth";
const SKIP_ROUTES = [
	AUTH_API_ROUTES,
	// Routes added by `auth-ui`
	"/auth/callback",
	"/auth/sign-in",
	"/auth/sign-up",
	"/auth/magic-link",
	"/auth/email-otp",
	"/auth/forgot-password",
];

/**
 * Helper function to protect routes from unauthenticated access.
 * Use this in TanStack Router's `beforeLoad` hook to validate session and redirect if needed.
 *
 * @param authConfig - Neon Auth configuration (bound automatically when accessed via `auth.protectRoute`)
 * @param routeConfig - Route protection configuration
 * @returns Promise that resolves if access is allowed
 * @throws redirect() - Throws TanStack Router redirect if authentication fails
 *
 * @example
 * ```typescript
 * // routes/_authed.tsx - Protected route group
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
 */
export async function protectRoute(
	authConfig: NeonAuthConfig,
	routeConfig: ProtectRouteConfig,
): Promise<void> {
	const { loginUrl = "/auth/sign-in", pathname } = routeConfig;

	const { getRequest } = await import("@tanstack/react-start/server");
	const { redirect } = await import("@tanstack/react-router");

	const request = getRequest();

	const result = await processAuthMiddleware({
		request,
		pathname,
		skipRoutes: SKIP_ROUTES,
		loginUrl,
		baseUrl: authConfig.baseUrl,
		cookieSecret: authConfig.cookies.secret,
		sessionDataTtl: authConfig.cookies.sessionDataTtl,
		domain: authConfig.cookies.domain,
	});

	switch (result.action) {
		case "allow": {
			return;
		}

		case "redirect_oauth": {
			if (result.cookies && result.cookies.length > 0) {
				const { setResponseHeader } = await import(
					"@tanstack/react-start/server"
				);
				for (const cookie of result.cookies) {
					setResponseHeader("Set-Cookie", cookie);
				}
			}
			const oauthPath = result.redirectUrl.pathname + result.redirectUrl.search;
			throw redirect({ to: oauthPath });
		}

		case "redirect_login": {
			if (result.cookies && result.cookies.length > 0) {
				const { setResponseHeader } = await import(
					"@tanstack/react-start/server"
				);
				for (const cookie of result.cookies) {
					setResponseHeader("Set-Cookie", cookie);
				}
			}
			throw redirect({ to: result.redirectUrl.pathname });
		}
	}
}
