import type { RequestContext } from "@/server";

/**
 * Creates a TanStack Start-specific RequestContext for Neon Auth.
 *
 * Bridges TanStack Start's server utilities to the framework-agnostic
 * RequestContext interface used by the Neon Auth core.
 *
 * Uses getCookie()/getRequestHeaders() from TanStack Start's AsyncLocalStorage
 * context rather than raw request.headers, so cookies set mid-cycle via
 * setCookie() are visible within the same request.
 *
 * Uses a dynamic import for `@tanstack/react-start/server` to avoid Vite's
 * dev-time module graph walking through the barrel export, which includes
 * virtual modules that only resolve during SSR.
 *
 * @internal
 */
export async function createTanStackStartRequestContext(): Promise<RequestContext> {
	const {
		getRequest,
		getRequestHeaders,
		getCookies,
		setCookie: tanstackSetCookie,
	} = await import("@tanstack/react-start/server");

	const request = getRequest();
	const headers = getRequestHeaders();

	return {
		getCookies: () => {
			const allCookies = getCookies();
			return Object.entries(allCookies)
				.map(([name, value]) => `${name}=${value}`)
				.join("; ");
		},
		setCookie: (name, value, options) =>
			tanstackSetCookie(name, value, {
				maxAge: options.maxAge,
				expires: options.expires,
				path: options.path || "/",
				domain: options.domain,
				secure: options.secure,
				httpOnly: options.httpOnly,
				sameSite: options.sameSite as "strict" | "lax" | "none" | undefined,
				partitioned: options.partitioned,
			}),
		getHeader: (name) =>
			(headers[name as keyof typeof headers] as string) || null,
		getOrigin: () =>
			request.headers.get("origin") ||
			request.headers.get("referer")?.split("/").slice(0, 3).join("/") ||
			"",
		getFramework: () => "tanstack-start",
	};
}
