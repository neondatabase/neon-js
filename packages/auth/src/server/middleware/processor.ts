import { needsSessionVerification, exchangeOAuthToken } from './oauth';
import { validateSessionFromCookie } from './session';
import { checkSessionRequired } from './route-protection';
import { NEON_AUTH_HEADER_MIDDLEWARE_NAME } from '../proxy';
import type { SessionData } from '../types';

/**
 * Result of middleware processing (framework-agnostic decision)
 */
export type MiddlewareResult =
	| { action: 'allow'; headers?: Record<string, string> }
	| { action: 'redirect_oauth'; redirectUrl: URL; cookies: string[] }
	| { action: 'redirect_login'; redirectUrl: URL };

export interface AuthMiddlewareConfig {
	/** Standard Web API Request object */
	request: Request;
	/** URL pathname being accessed */
	pathname: string;
	/** Routes that don't require authentication */
	skipRoutes: string[];
	/** URL to redirect to for login */
	loginUrl: string;
	/** Base URL of Neon Auth server */
	baseUrl: string;
	/** Secret for signing session cookies */
	cookieSecret: string;
	/**
	 * Optional fallback to fetch session from upstream if not in cache
	 * Framework-specific implementation (e.g., Next.js uses fetchSession with next/headers)
	 */
	fetchSessionFallback?: (
		baseUrl: string,
		cookieSecret: string
	) => Promise<SessionData>;
}

/**
 * Generic authentication middleware processor (framework-agnostic)
 *
 * Handles the complete middleware flow:
 * 1. Check if login URL (skip auth)
 * 2. Check OAuth verification (exchange token)
 * 3. Validate session from cookie cache
 * 4. Check if route requires protection
 * 5. Optionally fetch session from upstream if not cached
 * 6. Return decision object
 *
 * This is framework-agnostic - it returns a decision, NOT a framework-specific response.
 * The calling framework converts the decision to its response type (NextResponse, etc.)
 *
 * @param config - Middleware configuration
 * @returns Decision object indicating what action to take
 */
export async function processAuthMiddleware(
	config: AuthMiddlewareConfig
): Promise<MiddlewareResult> {
	const {
		request,
		pathname,
		skipRoutes,
		loginUrl,
		baseUrl,
		cookieSecret,
		fetchSessionFallback,
	} = config;

	// Always skip session check for login URL to prevent infinite redirect loop
	if (pathname.startsWith(loginUrl)) {
		return { action: 'allow' };
	}

	// For OAuth flow, the callback from Neon Auth will include a session verifier token in the query params
	// We need to exchange the verifier token and session challenge for the session cookie
	const verification = needsSessionVerification(request);
	if (verification) {
		const exchangeResult = await exchangeOAuthToken(request, baseUrl, cookieSecret);
		if (exchangeResult !== null) {
			// OAuth exchange successful - redirect with session cookies
			return {
				action: 'redirect_oauth',
				redirectUrl: exchangeResult.redirectUrl,
				cookies: exchangeResult.cookies,
			};
		}
	}

	// Try session cookie cache first
	const cookieHeader = request.headers.get('cookie') || '';
	const cachedSession = await validateSessionFromCookie(cookieHeader, cookieSecret);

	// Check if session is required for this route
	const checkResult = checkSessionRequired(pathname, skipRoutes, loginUrl, cachedSession);

	if (checkResult.allowed) {
		// Session valid or route doesn't require authentication
		return {
			action: 'allow',
			headers: {
				[NEON_AUTH_HEADER_MIDDLEWARE_NAME]: 'true',
			},
		};
	}

	// Session required but not found in cache - try fetching from upstream if callback provided
	if (!cachedSession && fetchSessionFallback) {
		const session = await fetchSessionFallback(baseUrl, cookieSecret);
		if (session.session !== null) {
			// Session exists - allow request
			return {
				action: 'allow',
				headers: {
					[NEON_AUTH_HEADER_MIDDLEWARE_NAME]: 'true',
				},
			};
		}
	}

	// No valid session and session is required - redirect to login
	return {
		action: 'redirect_login',
		redirectUrl: new URL(loginUrl, request.url),
	};
}
