import { needsSessionVerification, exchangeOAuthToken } from './oauth';
import { checkSessionRequired } from './route-protection';
import { NEON_AUTH_HEADER_MIDDLEWARE_NAME } from '../proxy';
import { handleAuthProxyRequest } from '../proxy';
import { NEON_AUTH_SESSION_COOKIE_NAME, NEON_AUTH_SESSION_DATA_COOKIE_NAME } from '../constants';
import type { SessionData } from '../types';
import { parseCookies } from 'better-auth/cookies';
import { serializeSetCookie } from '../utils/cookies';

/**
 * Result of middleware processing (framework-agnostic decision)
 */
export type MiddlewareResult =
	| { action: 'allow'; headers?: Record<string, string> }
	| { action: 'redirect_oauth'; redirectUrl: URL; cookies: string[] }
	| { action: 'redirect_login'; redirectUrl: URL; cookies?: string[] };

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
	/** Time-to-live for session data cache in seconds */
	sessionDataTtl?: number;
	/** Cookie domain for session data cookie */
	domain?: string;
}

/**
 * Generic authentication middleware processor (framework-agnostic)
 *
 * Handles the complete middleware flow:
 * 1. Check if login URL (skip auth)
 * 2. Check OAuth verification (exchange token)
 * 3. Get session (delegates to handleAuthProxyRequest for cookie cache + upstream fallback)
 * 4. Check if route requires protection
 * 5. Return decision object
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
		sessionDataTtl,
		domain,
	} = config;

	// Always skip session check for login URL to prevent infinite redirect loop
	if (pathname.startsWith(loginUrl)) {
		return { action: 'allow' };
	}

	// For OAuth flow, the callback from Neon Auth will include a session verifier token in the query params
	// We need to exchange the verifier token and session challenge for the session cookie
	const verification = needsSessionVerification(request);
	if (verification) {
		const exchangeResult = await exchangeOAuthToken(
			request,
			baseUrl,
			cookieSecret,
			sessionDataTtl,
			domain
		);
		if (exchangeResult !== null) {
			// OAuth exchange successful - redirect with session cookies
			return {
				action: 'redirect_oauth',
				redirectUrl: exchangeResult.redirectUrl,
				cookies: exchangeResult.cookies,
			};
		}
	}

	// Check for session token cookie
	const cookieHeader = request.headers.get('cookie') || '';
	const hasSessionToken = cookieHeader.includes(NEON_AUTH_SESSION_COOKIE_NAME);

	// Check for stale session_data cookie (exists without session_token)
	const parsedCookies = parseCookies(cookieHeader);
	const hasSessionData = parsedCookies.has(NEON_AUTH_SESSION_DATA_COOKIE_NAME);
	const hasStaleSessionData = hasSessionData && !hasSessionToken;

	let sessionData: SessionData = { session: null, user: null };

	if (hasSessionToken) {
		// Session token present - get session by calling handleAuthProxyRequest
		// (handles cookie cache + upstream fallback)
		const sessionResponse = await handleAuthProxyRequest({
			request,
			path: 'get-session',
			baseUrl,
			cookieSecret,
			sessionDataTtl,
			domain,
		});

		// Parse session data from response
		if (sessionResponse.ok) {
			const data = await sessionResponse.json().catch(() => null);
			if (data) {
				sessionData = data as SessionData;
			}
		}
	}

	// Check if session is required for this route
	const checkResult = checkSessionRequired(pathname, skipRoutes, loginUrl, sessionData);

	// Session valid or route doesn't require authentication
	if (checkResult.allowed) {
		return {
			action: 'allow',
			headers: {
				[NEON_AUTH_HEADER_MIDDLEWARE_NAME]: 'true',
			},
		};
	}

	// No valid session and session is required - redirect to login
	// If stale session_data exists, clear it to prevent redirect loops
	const cookies: string[] = [];
	if (hasStaleSessionData) {
		cookies.push(serializeSetCookie({
			name: NEON_AUTH_SESSION_DATA_COOKIE_NAME,
			value: '',
			path: '/',
			domain,
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			maxAge: 0,
		}));
	}

	return {
		action: 'redirect_login',
		redirectUrl: new URL(loginUrl, request.url),
		cookies: cookies.length > 0 ? cookies : undefined,
	};
}
