// Re-export from core for backwards compatibility
export { NEON_AUTH_COOKIE_PREFIX } from '../server/constants';
import { NEON_AUTH_COOKIE_PREFIX } from '../server/constants';

export const NEON_AUTH_SESSION_COOKIE_NAME = `${NEON_AUTH_COOKIE_PREFIX}.session_token`;
// Note: The typo in cookie name `challange` is to match the typo in Auth Server.
export const NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME = `${NEON_AUTH_COOKIE_PREFIX}.session_challange`;
export const NEON_AUTH_HEADER_MIDDLEWARE_NAME = 'X-Neon-Auth-Next-Middleware';

/** Name of the signed session data cookie for local validation */
export const NEON_AUTH_SESSION_DATA_COOKIE_NAME = `${NEON_AUTH_COOKIE_PREFIX}.next.session_data`;

