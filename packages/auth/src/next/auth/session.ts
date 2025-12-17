import { cookies, headers } from 'next/headers';
import type {
  BetterAuthSession as Session,
  BetterAuthUser as User,
} from '../../core/better-auth-types';
import { getUpstreamURL } from '../handler/request';
import { NEON_AUTH_BASE_URL } from '../env-variables';

import { extractNeonAuthCookies, parseSetCookies } from "../../utils/cookies"

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
 * A utility function to be used in react server components fetch the session details from the Neon Auth API, if session token is available in cookie.
 *
 * @returns - `{ session: Session, user: User }` | `{ session: null, user: null}`.
 *
 * @example
 * ```ts
 * import { neonAuth } from "@neondatabase/auth/next"
 *
 * const { session, user } = await neonAuth()
 * ```
 */
export const neonAuth = async (): Promise<SessionData> => {
  return await fetchSession();
};

/**
 * A utility function to fetch the session details from the Neon Auth API, if session token is available in cookie.
 *
 * @returns - `{ session: Session, user: User }` | `{ session: null, user: null}`.
 */
export const fetchSession = async (): Promise<SessionData> => {
  const baseUrl = NEON_AUTH_BASE_URL!;
  const requestHeaders = await headers();
  const upstreamURL = getUpstreamURL(baseUrl, 'get-session', {
    originalUrl: new URL('get-session', baseUrl),
  });

  const response = await fetch(upstreamURL.toString(), {
    method: 'GET',
    headers: {
      Cookie: extractNeonAuthCookies(requestHeaders),
    },
  });

  const body = await response.json();
  const cookieHeader = response.headers.get('set-cookie');
  if (cookieHeader) {
    const cookieStore = await cookies();
    parseSetCookies(cookieHeader).map((cookie) => {
      cookieStore.set(cookie.name, cookie.value, cookie);
    });
  }

  if (!response.ok || body === null) {
    return { session: null, user: null };
  }
  return { session: body.session, user: body.user };
};
