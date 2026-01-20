import { cookies, headers } from 'next/headers';

import { getUpstreamURL } from '../handler/request';

import { extractNeonAuthCookies, parseSetCookies } from '@/server/utils/cookies';
import { signSessionDataCookie, validateSessionData, parseSessionData } from '@/server/session';
import { NEON_AUTH_SESSION_DATA_COOKIE_NAME } from '../constants';
import type { SessionData } from '@/server/types';
import { assertCookieSecret, assertDefined } from '@/server/session/validator';
import { ERRORS } from '@/server/errors';

/**
 * A utility function to be used in react server components to fetch the session details.
 *
 * Behavior:
 * - If NEON_AUTH_COOKIE_SECRET is set: Tries cache first, falls back to API
 * - If NEON_AUTH_COOKIE_SECRET is missing: Always calls API (backward compatibility)
 *
 * @param config - Optional configuration (falls back to environment variables)
 * @returns - `{ session: Session, user: User }` | `{ session: null, user: null}`.
 *
 * @example
 * ```ts
 * import { neonAuth } from "@neondatabase/auth/next/server"
 *
 * // Uses environment variables (backward compatible)
 * const { session, user } = await neonAuth()
 *
 * // Or with explicit config
 * const { session, user } = await neonAuth({ baseUrl, cookieSecret })
 * ```
 */
export const neonAuth = async (config?: {
  baseUrl?: string;
  cookieSecret?: string;
}): Promise<SessionData> => {
  const baseUrl = config?.baseUrl ?? process.env.NEON_AUTH_BASE_URL;
  const cookieSecret = config?.cookieSecret ?? process.env.NEON_AUTH_COOKIE_SECRET;

  assertDefined(baseUrl, new Error(ERRORS.MISSING_AUTH_BASE_URL));
  
  // Backward compatibility: if secret not configured, use pre-PR behavior
  if (!cookieSecret) {
    return await fetchSession({ disableRefresh: true, 
      baseUrl,
      cookieSecret,
     });
  }

  assertCookieSecret(cookieSecret);
  // Try cache first
  const cookieStore = await cookies();
  const sessionDataCookie = cookieStore.get(NEON_AUTH_SESSION_DATA_COOKIE_NAME)?.value;

  if (sessionDataCookie) {
    try {
      const result = await validateSessionData(sessionDataCookie, cookieSecret);

      if (result.valid && result.payload) {
        // Cache hit - fast path
        return result.payload;
      }

      // Cache miss - invalid cookie
      console.debug('[neonAuth] Invalid session cookie, fetching from API:', {
        error: result.error,
      });
    } catch (error) {
      // Validation error - log and fall through
      console.error('[neonAuth] Cookie validation error:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Fallback: fetch from API
  return await fetchSession({ disableRefresh: true, baseUrl, cookieSecret });
};

/**
 * A utility function to fetch the session details from the Neon Auth API, if session token is available in cookie.
 *
 * @param options - Fetch options
 * @param options.disableRefresh - If true, don't refresh the session cookie (read-only)
 * @param options.baseUrl - base URL (falls back to environment variable)
 * @param options.cookieSecret - cookie secret (falls back to environment variable)
 * @returns - `{ session: Session, user: User }` | `{ session: null, user: null}`.
 */
export const fetchSession = async (options: {
  disableRefresh?: boolean;
  baseUrl: string;
  cookieSecret?: string;
}): Promise<SessionData> => {
  const baseUrl = options.baseUrl;
  const requestHeaders = await headers();

  const originalUrl = new URL('get-session', baseUrl);
  if (options?.disableRefresh) {
    originalUrl.searchParams.set('disableRefresh', 'true');
  }

  const upstreamURL = getUpstreamURL(baseUrl, 'get-session', {
    originalUrl,
  });

  // STEP 1: Network request with timeout
  let response: Response;
  try {
    response = await fetch(upstreamURL.toString(), {
      method: 'GET',
      headers: {
        Cookie: extractNeonAuthCookies(requestHeaders),
      },
      signal: AbortSignal.timeout(3000), // 3s timeout
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[fetchSession] Network error:', {
      url: upstreamURL.toString(),
      error: errorMessage,
      errorName: error instanceof Error ? error.name : 'Unknown',
      isTimeout: errorMessage.includes('timeout') || errorMessage.includes('aborted'),
    });

    return { session: null, user: null };
  }

  // STEP 2: Parse JSON response
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    console.error('[fetchSession] JSON parse error:', {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      error: error instanceof Error ? error.message : String(error),
    });

    return { session: null, user: null };
  }

  // STEP 3: Handle upstream set-cookie headers
  const cookieStore = await cookies();
  const cookieHeader = response.headers.get('set-cookie');
  if (cookieHeader) {
    try {
      for (const cookie of parseSetCookies(cookieHeader)) {
        cookieStore.set(cookie.name, cookie.value, cookie);
      }
    } catch (error) {
      const isExpectedError = error instanceof Error &&
        error.message.includes('cookies can only be modified');

      if (!isExpectedError) {
        console.error('[fetchSession] Failed to set upstream cookies:', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // STEP 4: Check response status
  if (!response.ok || body === null) {
    console.warn('[fetchSession] Non-OK response from upstream:', {
      status: response.status,
      statusText: response.statusText,
      bodyIsNull: body === null,
      url: upstreamURL.toString(),
    });

    return { session: null, user: null };
  }

  // STEP 5: Parse session data (validates dates)
  const sessionData = parseSessionData(body);

  if (sessionData.session === null) {
    return sessionData;
  }

  // STEP 6: Create session data cookie if caching is enabled
  if (options.cookieSecret) {
    try {
      const { value: signedData, expiresAt } = await signSessionDataCookie(sessionData, options.cookieSecret);

      cookieStore.set(NEON_AUTH_SESSION_DATA_COOKIE_NAME, signedData, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        expires: expiresAt,
      });
    } catch (error) {
      // Expected in RSC context - middleware will handle cookie creation
      const isExpectedError = error instanceof Error &&
        (error.message.includes('cookies can only be modified') ||
         error.message.includes('Server Actions') ||
         error.message.includes('Route Handlers'));

      if (!isExpectedError) {
        console.error('[fetchSession] Unexpected cookie creation error:', {
          error: error instanceof Error ? error.message : String(error),
          hasSession: !!sessionData.session,
        });
      }
    }
  }

  return sessionData;
};
