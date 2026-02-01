import { handleAuthProxyRequest } from '@/server/proxy';
import type { NeonAuthConfig } from '@/server/config';
import { validateCookieConfig } from '@/server/config';

/**
 * Creates a TanStack Start server function that handles auth API requests
 * and proxies them to the Neon Auth service.
 *
 * This should be exported from your API file and called from the client.
 *
 * @param config - Required configuration
 * @param config.baseUrl - Base URL of your Neon Auth instance
 * @param config.cookies - Cookie configuration
 * @param config.cookies.secret - Secret for signing session cookies (minimum 32 characters)
 * @param config.cookies.sessionDataTtl - Optional TTL for session cache in seconds (default: 300)
 * @param config.cookies.domain - Optional cookie domain (default: current domain)
 * @returns A TanStack Start server function
 * @throws Error if `cookies.secret` is less than 32 characters
 *
 * @example
 * ```typescript
 * // app/lib/auth-server.ts
 * import { createAuthHandler } from '@neondatabase/auth/tanstack-start/server';
 *
 * export const authHandler = createAuthHandler({
 *   baseUrl: process.env.NEON_AUTH_BASE_URL!,
 *   cookies: {
 *     secret: process.env.NEON_AUTH_COOKIE_SECRET!,
 *   },
 * });
 *
 * // app/api.ts - Export server functions
 * import { authHandler } from './lib/auth-server';
 * export { authHandler };
 *
 * // Client-side usage (automatic via auth client)
 * // The auth client will call this server function under the hood
 * ```
 */
export function createAuthHandler(config: NeonAuthConfig) {
	const { baseUrl, cookies } = config;

	validateCookieConfig(cookies);

	// Note: We cannot use createServerFn here because it needs to be called
	// where it's exported. The actual server function will be created by the user.
	// This returns a handler function that can be used with createServerFn.
	return async (request: Request, data: { path?: string }) => {
		const path = data.path || '';

		return handleAuthProxyRequest({
			request,
			path,
			baseUrl,
			cookieSecret: cookies.secret,
			sessionDataTtl: cookies.sessionDataTtl,
			domain: cookies.domain,
		});
	};
}
