/** Prefix for all Neon Auth cookies */
export const NEON_AUTH_COOKIE_PREFIX = '__Secure-neon-auth';

/** Cookie name for cached session data (signed JWT) - used for server-side session caching */
export const NEON_AUTH_SESSION_DATA_COOKIE_NAME = `${NEON_AUTH_COOKIE_PREFIX}.local.session_data`;