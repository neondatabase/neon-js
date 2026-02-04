import { signSessionDataCookie } from './operations';
import { fetchSessionWithCookie } from './operations';
import { NEON_AUTH_SESSION_DATA_COOKIE_NAME } from '../constants';
import { serializeSetCookie } from '../utils/cookies';
import type { SessionCookieConfig } from '../config';

/**
 * Core minting logic - creates session_data cookie from session token
 *
 * @param sessionTokenCookie - Session token cookie string (format: "name=value")
 * @param baseUrl - Auth server base URL
 * @param cookieConfig - Cookie configuration
 * @returns Set-Cookie string or null on error
 */
async function mintSessionDataCookie(
  sessionTokenCookie: string,
  baseUrl: string,
  cookieConfig: SessionCookieConfig
): Promise<string | null> {
  try {
    // Fetch session data from upstream using the session token
    const sessionData = await fetchSessionWithCookie(sessionTokenCookie, baseUrl);

    if (!sessionData.session) {
      return null; // No valid session
    }

    // Sign the session data into a JWT cookie
    const { value: signedData, expiresAt } = await signSessionDataCookie(
      sessionData,
      cookieConfig.secret,
      cookieConfig.sessionDataTtl
    );

    // Calculate Max-Age in seconds (relative time, immune to clock skew)
    const maxAge = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

    // Serialize to Set-Cookie string
    return serializeSetCookie({
      name: NEON_AUTH_SESSION_DATA_COOKIE_NAME,
      value: signedData,
      path: '/',
      domain: cookieConfig.domain,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[mintSessionDataCookie] Failed to mint session_data cookie:', {
      error: errorMessage,
      ...(process.env.NODE_ENV !== 'production' && {
        stack: error instanceof Error ? error.stack : undefined,
      }),
    });
    return null;
  }
}

/**
 * Utility A: Mint session_data cookie when session_token is updated by upstream
 *
 * Checks response headers for session_token in Set-Cookie, then mints session_data.
 * Handles token deletion (max-age=0) by returning deletion cookie.
 *
 * Use case: Response handling in proxy/middleware after upstream auth calls
 *
 * @param responseHeaders - Response headers from upstream auth server
 * @param baseUrl - Auth server base URL
 * @param cookieConfig - Cookie configuration
 * @returns Set-Cookie string for session_data or null if no action needed
 */
export async function mintSessionDataFromResponse(
  responseHeaders: Headers,
  baseUrl: string,
  cookieConfig: SessionCookieConfig
): Promise<string | null> {
  // Check if upstream set a session_token cookie
  const setCookieHeaders = responseHeaders.getSetCookie();
  const sessionTokenCookie = setCookieHeaders.find(cookie =>
    cookie.includes('session_token')
  );

  if (!sessionTokenCookie) {
    return null; // No session token in response, nothing to mint
  }

  // Check if session_token is being deleted (sign-out scenario)
  const sessionCookieLower = sessionTokenCookie.toLowerCase();
  if (sessionCookieLower.includes('max-age=0')) {
    // Return deletion cookie for session_data
    return serializeSetCookie({
      name: NEON_AUTH_SESSION_DATA_COOKIE_NAME,
      value: '',
      path: '/',
      domain: cookieConfig.domain,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 0,
    });
  }

  // Session token was set/updated - mint new session_data cookie
  return await mintSessionDataCookie(sessionTokenCookie, baseUrl, cookieConfig);
}

/**
 * Utility B: Mint/refresh session_data cookie from existing session_token
 *
 * Extracts session_token from request cookies and mints a fresh session_data cookie.
 * Use case: Cache misses, expired cookies, proactive refresh
 *
 * @param sessionTokenCookie - Session token cookie string (format: "name=value")
 * @param baseUrl - Auth server base URL
 * @param cookieConfig - Cookie configuration
 * @returns Set-Cookie string for session_data or null on error
 */
export async function mintSessionDataFromToken(
  sessionTokenCookie: string,
  baseUrl: string,
  cookieConfig: SessionCookieConfig
): Promise<string | null> {
  return await mintSessionDataCookie(sessionTokenCookie, baseUrl, cookieConfig);
}
