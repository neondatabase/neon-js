/** Prefix for all Neon Auth cookies */
export const NEON_AUTH_COOKIE_PREFIX = '__Secure-neon-auth';

/** Cookie name for cached session data (signed JWT) - used for server-side session caching */
export const NEON_AUTH_SESSION_DATA_COOKIE_NAME = `${NEON_AUTH_COOKIE_PREFIX}.local.session_data`;

/**
 * Legacy (misspelled) OAuth session challenge cookie name. Older Neon Auth servers
 * set ONLY this name; newer servers dual-write both names so this SDK can read either.
 *
 * Drop this constant once all production deployments of the Neon Auth server have
 * shipped the dual-write change (see databricks-eng/neon-cloud#6472).
 */
export const NEON_AUTH_LEGACY_SESSION_CHALLANGE_COOKIE_NAME = `${NEON_AUTH_COOKIE_PREFIX}.session_challange`;

/**
 * Cookie name for OAuth session challenge - used for OAuth flow security.
 * New Neon Auth servers prefer this correctly-spelled name; the SDK reads
 * this first and falls back to the legacy entry above for backward
 * compatibility with old servers in the field.
 */
export const NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME = `${NEON_AUTH_COOKIE_PREFIX}.session_challenge`;

/** Cookie name for session token - the primary authentication cookie */
export const NEON_AUTH_SESSION_COOKIE_NAME = `${NEON_AUTH_COOKIE_PREFIX}.session_token`;