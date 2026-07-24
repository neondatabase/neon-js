/**
 * `@neondatabase/auth/server` — framework-agnostic toolkit for building
 * Neon Auth framework adapters.
 *
 * This subpath exposes the primitives the bundled `@neondatabase/auth/next/server`
 * adapter is built on, so the community can build adapters for additional
 * server frameworks (Hono, Remix, SolidStart, Express, Fastify, etc.) without
 * forking the package.
 *
 * **Stability: beta.** Minor versions may include breaking changes with
 * migration notes in the package CHANGELOG. Pin your peer dependency
 * accordingly.
 *
 * See `BUILDING-AN-ADAPTER.md` in the package root for the adapter author guide.
 *
 * @module
 */

// --- Core factory --------------------------------------------------------

export {
	createAuthServer,
	type NeonAuthServerConfig,
} from './client-factory';

// --- Request context contract (what adapter authors implement) -----------

export {
	type RequestContext,
	type RequestContextFactory,
	type CookieOptions,
	NEON_AUTH_SERVER_PROXY_HEADER,
} from './request-context';

// --- Proxy primitives (catch-all /api/auth/* handler) --------------------

export {
	handleAuthProxyRequest,
	handleAuthRequest,
	handleAuthResponse,
	NEON_AUTH_HEADER_MIDDLEWARE_NAME,
	type AuthProxyConfig,
} from './proxy';

// --- Middleware primitives (route protection) ----------------------------

export {
	processAuthMiddleware,
	shouldProtectRoute,
	checkSessionRequired,
	DEFAULT_AUTH_SKIP_ROUTES,
	type AuthMiddlewareConfig,
	type MiddlewareResult,
	type SessionCheckResult,
} from './middleware';

// --- Config + validation -------------------------------------------------

export {
	validateCookieConfig,
	type NeonAuthConfig,
	type NeonAuthMiddlewareConfig,
	type SessionCookieConfig,
	type SessionCookieSameSite,
} from './config';

// --- Logging -------------------------------------------------------------

export {
	resolveNeonAuthLogging,
	type NeonAuthLogger,
	type NeonAuthLogLevel,
	type NeonAuthLoggingInput,
	type ResolvedNeonAuthLogging,
} from './logger';

// --- Network error classification ----------------------------------------

export {
	NEON_AUTH_NETWORK_ERROR_CODES,
	classifyFetchFailure,
	type NeonAuthNetworkErrorCode,
	type ClassifiedFetchFailure,
} from './network-error';

// --- Session helpers (for adapters populating framework context) ---------

export { parseSessionData, validateSessionData } from './session';

// --- Server types --------------------------------------------------------

export type {
	NeonAuthServer,
	NeonAuthServerApiError,
	SessionData,
	SessionDataCookie,
	RequireSessionData,
} from './types';

// --- Cookie utilities (for bridging framework cookie APIs) ---------------

export {
	parseSetCookies,
	serializeSetCookie,
	parseCookieValue,
	extractNeonAuthCookies,
	type ParsedCookie,
} from './utils/cookies';

// --- Protocol constants --------------------------------------------------

export {
	NEON_AUTH_COOKIE_PREFIX,
	NEON_AUTH_SESSION_COOKIE_NAME,
	NEON_AUTH_SESSION_DATA_COOKIE_NAME,
	NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME,
} from './constants';

// --- NOT exported: Supabase-flavored AuthError / AuthApiError -------------
//
// `AuthError` / `AuthApiError` / `isAuthError` / `isAuthApiError` are
// `@supabase/auth-js` re-exports used by `SupabaseAuthAdapter`. Surfacing them
// from this vendor-neutral toolkit would couple every adapter author's public
// contract to a pinned Supabase version and risk `instanceof`-across-realms
// failures.
//
// Toolkit-side error handling lives on the `NeonAuthServerApiError` envelope
// returned by `createAuthServer` server methods (typed `{ message, status,
// statusText, code }` with `code: NeonAuthNetworkErrorCode | 'INTERNAL_ERROR'
// | (string & {})`). Adapter authors should narrow on `error.code` rather
// than `instanceof AuthError`.
//
// Supabase consumers can still import them directly from
// `@neondatabase/auth/vanilla/adapters` (where `SupabaseAuthAdapter` lives).
// See #161 review feedback (Andras item 7).
