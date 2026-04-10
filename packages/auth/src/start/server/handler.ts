import type { NeonAuthConfig } from "@/server/config";
import { validateCookieConfig } from "@/server/config";
import { handleAuthProxyRequest } from "@/server/proxy";

/**
 * @internal
 * Creates a handler from a config getter. Used by createNeonAuth.
 */
export function createHandlerFromConfig(getConfig: () => NeonAuthConfig) {
	let cachedConfig: NeonAuthConfig | null = null;

	function getValidatedConfig() {
		if (!cachedConfig) {
			cachedConfig = getConfig();
			validateCookieConfig(cachedConfig.cookies);
		}
		return cachedConfig;
	}

	return async (ctx: { request: Request; params: Record<string, string> }) => {
		const config = getValidatedConfig();

		return handleAuthProxyRequest({
			request: ctx.request,
			path: ctx.params._splat,
			baseUrl: config.baseUrl,
			cookieSecret: config.cookies.secret,
			sessionDataTtl: config.cookies.sessionDataTtl,
			domain: config.cookies.domain,
		});
	};
}
