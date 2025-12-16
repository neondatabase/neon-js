// Re-export from core for backwards compatibility
export { NEON_AUTH_COOKIE_PREFIX } from '../core/constants';
import { NEON_AUTH_COOKIE_PREFIX } from '../core/constants';

export const NEON_AUTH_SESSION_COOKIE_NAME = `${NEON_AUTH_COOKIE_PREFIX}.session_token`;
export const NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME = `${NEON_AUTH_COOKIE_PREFIX}.session_challange`;
export const NEON_AUTH_HEADER_MIDDLEWARE_NAME = 'X-Neon-Auth-Next-Middleware';
