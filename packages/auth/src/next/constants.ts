export const NEON_AUTH_COOKIE_PREFIX = '__Secure-neon-auth';
export const NEON_AUTH_SESSION_COOKIE_NAME = `${NEON_AUTH_COOKIE_PREFIX}.session_token`;

export const NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME = `${NEON_AUTH_COOKIE_PREFIX}.session_challange`;
/** Name of the session verifier parameter in the URL, used for the OAUTH flow */
export const NEON_AUTH_SESSION_VERIFIER_PARAM_NAME =
  'neon_auth_session_verifier';

export const NEON_AUTH_HEADER_MIDDLEWARE_NAME = 'X-Neon-Auth-Next-Middleware';