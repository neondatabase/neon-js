/** Prefix for all Neon Auth cookies */
export const NEON_AUTH_COOKIE_PREFIX = '__Secure-neon-auth';

/** Cookie name for cached session data (signed JWT) - used for server-side session caching */
export const NEON_AUTH_SESSION_DATA_COOKIE_NAME = `${NEON_AUTH_COOKIE_PREFIX}.local.session_data`;

/** Cookie name for OAuth session challenge - used for OAuth flow security */
// Note: The typo in cookie name `challange` is intentional to match the typo in Auth Server
export const NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME = `${NEON_AUTH_COOKIE_PREFIX}.session_challange`;

/** Cookie name for session token - the primary authentication cookie */
export const NEON_AUTH_SESSION_COOKIE_NAME = `${NEON_AUTH_COOKIE_PREFIX}.session_token`;