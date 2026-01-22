export const ERRORS = {
  MISSING_AUTH_BASE_URL: 'Missing required config: baseUrl. You must provide the auth URL of your Neon Auth instance in the config object.',
  MISSING_COOKIE_SECRET: 'Missing required config: cookieSecret. You must provide the cookie secret in the config object.',
  COOKIE_SECRET_TOO_SHORT: 'cookieSecret must be at least 32 characters long for security. Generate a secure secret with: openssl rand -base64 32',
}