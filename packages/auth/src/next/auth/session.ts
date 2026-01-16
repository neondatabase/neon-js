import { cookies, headers } from 'next/headers';
import type {
  BetterAuthSession as Session,
  BetterAuthUser as User,
} from '../../core/better-auth-types';
import { getUpstreamURL } from '../handler/request';
import { NEON_AUTH_BASE_URL } from '../env-variables';

import { extractNeonAuthCookies, parseSetCookies } from '../../utils/cookies';
import { sessionToSignedCookie, validateSessionData } from '../../server/session';
import { NEON_AUTH_SESSION_DATA_COOKIE_NAME } from '../../core/constants';

export type SessionData =
  | {
      session: Session;
      user: User;
    }
  | {
      session: null;
      user: null;
    };

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
 * A utility function to be used in react server components to fetch the session details.
 *
 * @returns - `{ session: Session, user: User }` | `{ session: null, user: null}`.
 *
 * @example
 * ```ts
 * import { neonAuth } from "@neondatabase/auth/next/server"
 *
 * const { session, user } = await neonAuth()
 * ```
 */
export const neonAuth = async (): Promise<SessionData> => {
  // Read session data cookie (middleware guarantees validity)
  const cookieStore = await cookies();
  const sessionDataCookie = cookieStore.get(NEON_AUTH_SESSION_DATA_COOKIE_NAME)?.value;

  if (sessionDataCookie) {
    const result = await validateSessionData(sessionDataCookie);

    if (result.valid && result.payload) {
      // Payload is already SessionData (nested structure)
      return result.payload;
    }
  }

  // Fallback: Cookie missing or invalid
  // This only happens if neonAuth() called without middleware or on excluded routes
  // Use disableRefresh=true to avoid refreshing session during read-only operations
  // TODO: For GA release, we should remove this fallback and throw an error if the session data cookie is missing or invalid.
  return await fetchSession({ disableRefresh: true });
};

/**
 * A utility function to fetch the session details from the Neon Auth API, if session token is available in cookie.
 *
 * @param options - Fetch options
 * @param options.disableRefresh - If true, don't refresh the session cookie (read-only)
 * @returns - `{ session: Session, user: User }` | `{ session: null, user: null}`.
 */
export const fetchSession = async (options?: { disableRefresh?: boolean }): Promise<SessionData> => {
  const baseUrl = NEON_AUTH_BASE_URL!;
  const requestHeaders = await headers();

  const originalUrl = new URL('get-session', baseUrl);
  if (options?.disableRefresh) {
    originalUrl.searchParams.set('disableRefresh', 'true');
  }

  const upstreamURL = getUpstreamURL(baseUrl, 'get-session', {
    originalUrl,
  });

  const response = await fetch(upstreamURL.toString(), {
    method: 'GET',
    headers: {
      Cookie: extractNeonAuthCookies(requestHeaders),
    },
  });

  const body = await response.json();
  const cookieStore = await cookies();

  // Handle set-cookie from upstream
  const cookieHeader = response.headers.get('set-cookie');
  if (cookieHeader) {
    parseSetCookies(cookieHeader).map((cookie) => {
      cookieStore.set(cookie.name, cookie.value, cookie);
    });
  }

  if (!response.ok || body === null) {
    return { session: null, user: null };
  }

  // Parse session data (converts date strings to Date objects)
  const sessionData = parseSessionData(body);

  if (sessionData.session === null) {
    return sessionData;
  }

  // Create and set session data cookie for local validation
  try {
    const { sessionData: signedData, expiresAt } = await sessionToSignedCookie(sessionData);

    cookieStore.set(NEON_AUTH_SESSION_DATA_COOKIE_NAME, signedData, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });
  } catch {
    // Expected: cookies can only be modified in Server Actions/Route Handlers
    // Silently ignore - session data still works, middleware will handle cookie creation
  }

  return sessionData;
};
