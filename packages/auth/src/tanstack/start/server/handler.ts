import { handleAuthProxyRequest } from '../../../server/proxy';
import type { NeonAuthConfig } from '../../../server/config';

/**
 * Creates a TanStack Start handler that proxies auth API requests
 * to the Neon Auth service.
 *
 * @internal Called by createNeonAuth — config is already validated.
 *
 * @param config - Validated Neon Auth configuration
 * @returns Handler function compatible with TanStack Start server route handlers
 */
export function createAuthHandler(config: NeonAuthConfig) {
	const { baseUrl, cookies } = config;

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
