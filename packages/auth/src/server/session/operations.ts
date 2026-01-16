import { signSessionData, getCookieSecret, type SessionData, type SessionCookieData } from './signer';

// 5-minute TTL for session data cookie
const SESSION_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Convert session data from /get-session into a signed session data cookie
 * @param sessionData - Session and user data from Better Auth
 * @returns Signed session data string and expiration date
 */
export async function sessionToSignedCookie(
  sessionData: SessionData
): Promise<SessionCookieData> {
  const secret = getCookieSecret();

  const expiresAt = new Date(Math.min(
    sessionData.session.expiresAt.getTime(),
    Date.now() + SESSION_CACHE_TTL_MS
  ));

  const signedData = await signSessionData(sessionData, expiresAt, secret);
  return { sessionData: signedData, expiresAt };
}
