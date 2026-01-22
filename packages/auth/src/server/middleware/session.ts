import { validateSessionData } from '../session/validator';
import { NEON_AUTH_SESSION_DATA_COOKIE_NAME } from '../constants';
import type { SessionData } from '../types';
import { parseCookies } from 'better-auth/cookies';

/**
 * Validates session data from the cookie header
 * Returns session data if valid, `null` otherwise
 *
 * @param cookieHeader - Cookie header string from request
 * @param cookieSecret - Secret for validating signed session cookies
 * @returns Session data if valid, null if invalid/missing
 */
export async function validateSessionFromCookie(
  cookieHeader: string,
  cookieSecret: string
): Promise<SessionData | null> {
  if (!cookieHeader) {
    return null;
  }

  try {
    const cookies = parseCookies(cookieHeader);
    const sessionDataCookie = cookies.get(NEON_AUTH_SESSION_DATA_COOKIE_NAME);
    if (!sessionDataCookie) {
      return null;
    }

    const result = await validateSessionData(sessionDataCookie, cookieSecret);
    if (result.valid && result.payload) {
      return result.payload;
    }

    console.debug('[validateSessionFromCookie] Invalid session cookie:', {
      error: result.error,
    });

    return null;
  } catch (error) {
    console.error('[validateSessionFromCookie] Cookie validation error:', {
      error: error instanceof Error ? error.message : String(error),
    });

    return null;
  }
}
