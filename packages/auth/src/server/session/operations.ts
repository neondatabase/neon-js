import { getCookieSecret } from './signer';
import type { RequireSessionData, SessionData, SessionDataCookie } from '@/server/types';
import { validateSessionData } from './validator';
import { parseCookies } from 'better-auth/cookies';
import { SignJWT } from 'jose';

// 5-minute TTL for session data cookie
const SESSION_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Parse and validate date value, throwing descriptive error on failure
 * @internal
 */
function parseDate(dateValue: unknown, fieldName: string): Date {
  const date = new Date(dateValue as string);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date value for ${fieldName}: ${JSON.stringify(dateValue)}`);
  }
  return date;
}

/**
 * Check if session caching is enabled (secret is configured)
 */
export function isSessionCacheEnabled(): boolean {
  return process.env.NEON_AUTH_COOKIE_SECRET !== undefined;
}

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
 *
 * Note: Better Auth API returns ISO 8601 date strings. JSON.parse() does not
 * automatically convert these to Date objects, so manual conversion is required.
 *
 * @internal Exported for internal use by auth handler
 */
export function parseSessionData(json: unknown): SessionData {
  // Handle null/undefined/missing response
  if (!json || typeof json !== 'object') {
    return { session: null, user: null };
  }

  const data = json as any;

  // Handle explicit null session
  if (!data.session || !data.user) {
    return { session: null, user: null };
  }

  // Validate and parse dates
  try {
    return {
      session: {
        ...data.session,
        expiresAt: parseDate(data.session.expiresAt, 'session.expiresAt'),
        createdAt: parseDate(data.session.createdAt, 'session.createdAt'),
        updatedAt: parseDate(data.session.updatedAt, 'session.updatedAt'),
      },
      user: {
        ...data.user,
        createdAt: parseDate(data.user.createdAt, 'user.createdAt'),
        updatedAt: parseDate(data.user.updatedAt, 'user.updatedAt'),
      },
    };
  } catch (error) {
    console.error('[parseSessionData] Failed to parse session dates:', {
      error: error instanceof Error ? error.message : String(error),
      hasSession: !!data.session,
      hasUser: !!data.user,
    });

    // Return null session on parse error (graceful degradation)
    return { session: null, user: null };
  }
}

/**
 * Extract and validate session data from cookie header
 * Falls back to null on any error (caller should fetch from API)
 *
 * @param request - Request object with cookie header
 * @param cookieName - Name of session data cookie
 * @returns SessionData or null on validation failure
 */
export async function getSessionDataFromCookie(
  request: Request,
  cookieName: string
): Promise<SessionData | null> {
  try {
    // Extract cookie header
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) {
      return null; // No cookies - expected case
    }

    // Parse cookie header
    const parsedCookies = parseCookies(cookieHeader);
    const sessionDataCookie = parsedCookies.get(cookieName);

    if (!sessionDataCookie) {
      return null; // Cookie not present - expected case
    }

    // Validate cookie signature and expiry
    const result = await validateSessionData(sessionDataCookie);

    if (result.valid && result.payload) {
      return result.payload; // Valid cookie
    }

    // Cookie present but invalid - log for visibility
    console.warn('[getSessionDataFromCookie] Invalid session cookie:', {
      error: result.error,
      cookieName,
      // Don't log cookie value for security
    });

    return null;
  } catch (error) {
    // Unexpected error during extraction/validation
    console.error('[getSessionDataFromCookie] Unexpected validation error:', {
      error: error instanceof Error ? error.message : String(error),
      cookieName,
      ...(process.env.NODE_ENV !== 'production' && {
        stack: error instanceof Error ? error.stack : undefined,
      }),
    });

    return null; // Fallback to API call
  }
}