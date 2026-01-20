export const ERRORS = {
  MISSING_AUTH_BASE_URL: 'Missing environment variable: NEON_AUTH_BASE_URL. \n You must provide the auth url of your Neon Auth instance in environment variables',
  MISSING_COOKIE_SECRET: 'Missing environment variable: NEON_AUTH_COOKIE_SECRET. \n You must provide the cookie secret of your Neon Auth instance in environment variables',
  COOKIE_SECRET_TOO_SHORT: 'NEON_AUTH_COOKIE_SECRET must be at least 32 characters long',
}