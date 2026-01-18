import { getCookieSecret } from './signer';
import type { RequireSessionData, SessionData, SessionDataCookie } from '@/server/types';
import { validateSessionData } from './validator';
import { parseCookies } from 'better-auth/cookies';
import { SignJWT } from 'jose';

// 5-minute TTL for session data cookie
const SESSION_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Convert session data from /get-session into a signed cookie
 * @param sessionData - Session and user data from Auth server
 * @returns Signed session data cookie
 */
export async function signSessionDataCookie(
  sessionData: RequireSessionData
): Promise<SessionDataCookie> {
  const secret = getCookieSecret();

  const expiresAt = Math.min(
    sessionData.session.expiresAt.getTime(),
    Date.now() + SESSION_CACHE_TTL_MS
  );

  const value = await signPayload(sessionData, expiresAt, secret);
  return { value, expiresAt: new Date(expiresAt) };
}

function signPayload(
  sessionData: SessionData,
  expiresAt: number,
  secret: string
): Promise<string> {
  const encodedSecret = new TextEncoder().encode(secret);
  const expSeconds = Math.floor(expiresAt / 1000)

  // Sign the entire SessionData object (nested structure)
  return new SignJWT(sessionData)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(expSeconds)
    .setSubject(sessionData.user?.id ?? 'anonymous')
    .sign(encodedSecret);
}

/**
 * Parse session data from JSON, converting date strings to Date objects
 * @internal Exported for internal use by auth handler
 */
export function parseSessionData(json: any): SessionData {
  if (!json.session || !json.user) {
    return { session: null, user: null };
  }

  return {
    session: {
      ...json.session,
      expiresAt: new Date(json.session.expiresAt),
      createdAt: new Date(json.session.createdAt),
      updatedAt: new Date(json.session.updatedAt),
    },
    user: {
      ...json.user,
      createdAt: new Date(json.user.createdAt),
      updatedAt: new Date(json.user.updatedAt),
    },
  };
}

/**
 * Extract and validate session data from cookie in Request object
 *
 * @param request - The incoming Request object
 * @param cookieName - Name of the cookie to extract
 * @returns SessionData if cookie is valid, null otherwise
 */
export async function getSessionDataFromCookie(
  request: Request,
  cookieName: string
): Promise<SessionData | null> {
  try {
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) {
      return null;
    }

    const parsedCookies = parseCookies(cookieHeader);
    const sessionDataCookie = parsedCookies.get(cookieName);
    if (!sessionDataCookie) {
      return null;
    }

    // Validate the cookie signature and expiry
    const result = await validateSessionData(sessionDataCookie);
    if (result.valid && result.payload) {
      return result.payload;
    }

    return null;
  } catch {
    // Cookie validation error - return null for silent fallback
    return null;
  }
}