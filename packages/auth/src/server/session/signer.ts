import { ERRORS } from '@/server/errors';

/**
 * Get cookie secret from environment variable
 * @returns Cookie secret for session data signing
 * @throws Error if secret is missing or too short
 */
export function getCookieSecret(): string {
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;

  if (!secret) {
    throw new Error(
      ERRORS.MISSING_COOKIE_SECRET
    );
  }

  if (secret.length < 32) {
    throw new Error(ERRORS.COOKIE_SECRET_TOO_SHORT);
  }

  return secret;
}
