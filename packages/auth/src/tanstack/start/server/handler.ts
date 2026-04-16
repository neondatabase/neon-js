import type { NeonAuthConfig } from "@/server/config";
import { handleAuthProxyRequest } from "@/server/proxy";

export type TanStackStartAuthHandler = (ctx: { request: Request; params: Record<string, string> }) => Promise<Response>;

/**
 * @internal
 * Creates a handler from a resolved config. Used by createNeonAuth.
 */
export function createHandlerFromConfig(config: NeonAuthConfig): TanStackStartAuthHandler {
	return async (ctx) => {
		return handleAuthProxyRequest({
			request: ctx.request,
			path: ctx.params._splat ?? '',
			baseUrl: config.baseUrl,
			cookieSecret: config.cookies.secret,
			sessionDataTtl: config.cookies.sessionDataTtl,
			domain: config.cookies.domain,
		});
	};
}
