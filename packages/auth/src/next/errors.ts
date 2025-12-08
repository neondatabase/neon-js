export const ERRORS = {
  MISSING_AUTH_BASE_URL: 'Missing environment variable: NEON_AUTH_BASE_URL. \n You must provide the auth url of your Neon Auth instance in environment variables',
  NEON_AUTH_MIDDLEWARE_NOT_FOUND: 'You are calling `neonAuth` on a route that is not covered by `neonAuthMiddleware`. Make sure it is running on all paths you are calling `neonAuth` from by updating your middleware config in `(middleware|proxy).(js|ts)`.',
}