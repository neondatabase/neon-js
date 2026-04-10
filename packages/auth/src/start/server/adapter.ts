import type { RequestContext } from "@/server";
import { extractNeonAuthCookies } from "@/server/utils/cookies";

/**
 * Creates a TanStack Start-specific RequestContext for Neon Auth.
 *
 * Bridges TanStack Start's server utilities (getRequest, setCookie) to the
 * framework-agnostic RequestContext interface used by the Neon Auth core.
 *
 * Uses a dynamic import for `@tanstack/react-start/server` to avoid Vite's
 * dev-time module graph walking through the barrel export, which includes
 * virtual modules that only resolve during SSR.
 *
 * @internal
 */
export async function createTanStackStartRequestContext(): Promise<RequestContext> {
	const { getRequest, setCookie } = await import(
		"@tanstack/react-start/server"
	);
	const request = getRequest();
	return {
		getCookies: () => extractNeonAuthCookies(request.headers),
		setCookie: (name, value, options) => setCookie(name, value, options),
		getHeader: (name) => request.headers.get(name),
		getOrigin: () =>
			request.headers.get("origin") ||
			request.headers.get("referer")?.split("/").slice(0, 3).join("/") ||
			"",
		getFramework: () => "tanstack-start",
	};
}
