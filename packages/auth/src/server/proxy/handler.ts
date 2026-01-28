import { trySessionCache } from '../session/cache-handler';
import { handleAuthRequest } from './request';
import { handleAuthResponse } from './response';
import { API_ENDPOINTS } from '../endpoints';

export interface AuthProxyConfig {
	/** Standard Web API Request object */
	request: Request;
	/** API path to proxy (e.g., 'get-session', 'sign-in') */
	path: string;
	/** Base URL of Neon Auth server */
	baseUrl: string;
	/** Secret for signing session cookies */
	cookieSecret: string;
	/** Time-to-live for session data cache in seconds (default: 300 = 5 minutes) */
	sessionDataTtl?: number;
}

/**
 * Generic authentication proxy handler (framework-agnostic)
 *
 * Handles the complete flow:
 * 1. Check if request is for getSession endpoint
 * 2. Try session cache if applicable (< 1ms fast path)
 * 3. Call upstream Neon Auth API
 * 4. Handle response with cookie minting
 *
 * This is framework-agnostic and can be used by any server framework.
 *
 * @param config - Proxy configuration
 * @returns Standard Web API Response
 */
export async function handleAuthProxyRequest(config: AuthProxyConfig): Promise<Response> {
	const { request, path, baseUrl, cookieSecret, sessionDataTtl } = config;

	// Try cookie cache for /get-session GET requests (optimization)
	if (
		path === API_ENDPOINTS.getSession.path &&
		request.method === API_ENDPOINTS.getSession.method
	) {
		const cachedResponse = await trySessionCache(request, cookieSecret);
		if (cachedResponse) {
			// Cache hit - return immediately (no upstream call)
			return cachedResponse;
		}
	}

	// Fallback: Call upstream API
	const response = await handleAuthRequest(baseUrl, request, path);
	return await handleAuthResponse(response, { baseUrl, cookieSecret, sessionDataTtl });
}
