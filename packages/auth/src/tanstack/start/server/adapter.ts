import type { RequestContext } from '../../../server';

/**
 * Creates a TanStack Start-specific RequestContext that reads cookies and headers
 * from TanStack Start's request utilities and handles cookie setting.
 *
 * Uses TanStack Start's AsyncLocalStorage-based context system internally.
 * These utilities work within server functions, loaders, and beforeLoad hooks.
 */
export async function createTanStackStartRequestContext(): Promise<RequestContext> {
	// Dynamic import to avoid bundling server utilities in client code
	const {
		getRequest,
		getRequestHeaders,
		getCookie,
		setCookie: tanstackSetCookie,
	} = await import('@tanstack/react-start/server');

	// Get current request from TanStack Start's context
	const request = getRequest();
	const headers = getRequestHeaders();

	return {
		getCookies() {
			// Get all cookies and format as cookie header string
			// Format: "name1=value1; name2=value2"
			const allCookies = getCookie();
			return Object.entries(allCookies)
				.map(([name, value]) => `${name}=${value}`)
				.join('; ');
		},

		setCookie(name, value, options) {
			tanstackSetCookie(name, value, {
				maxAge: options.maxAge,
				expires: options.expires,
				path: options.path || '/',
				domain: options.domain,
				secure: options.secure,
				httpOnly: options.httpOnly,
				sameSite: options.sameSite as 'strict' | 'lax' | 'none' | undefined,
				// @ts-expect-error - partitioned may not be in TanStack Start's types yet
				partitioned: options.partitioned,
			});
		},

		getHeader(name) {
			return headers[name as keyof typeof headers] as string || null;
		},

		getOrigin() {
			return (
				request.headers.get('origin') ||
				request.headers.get('referer')?.split('/').slice(0, 3).join('/') ||
				''
			);
		},

		getFramework() {
			return 'tanstack-start';
		},
	};
}
