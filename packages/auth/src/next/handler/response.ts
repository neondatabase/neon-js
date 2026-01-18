import { signSessionDataCookie } from '../../server/session';
import { NEON_AUTH_SESSION_DATA_COOKIE_NAME } from '../constants';
import { parseSetCookies } from '../../server/utils/cookies';
import type { SessionData } from '@/server/types';
import { parseSessionData } from '@/server/session/operations';

// Allowlist of response headers that we want to proxy to the client from Neon Auth.
const RESPONSE_HEADERS_ALLOWLIST = ['content-type', 'content-length', 'content-encoding', 'transfer-encoding',
    'connection', 'date',
   'set-cookie', 'set-auth-jwt', 'set-auth-token', 'x-neon-ret-request-id'];

export const handleAuthResponse = async (response: Response) => {
  const responseHeaders = prepareResponseHeaders(response);

  // If session cookie secret is set, procure session data cookie from upstream response
  if (process.env.NEON_AUTH_COOKIE_SECRET !== undefined) {
    const sessionDataCookie = await procureSessionData(response.headers);
    if (sessionDataCookie) {
      responseHeaders.set('set-cookie', sessionDataCookie);
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}

const prepareResponseHeaders = (response: Response) => {
  const headers = new Headers();
  for (const header of RESPONSE_HEADERS_ALLOWLIST) {
    const value = response.headers.get(header);
    if (value) {
      headers.set(header, value);
    }
  }
  return headers;
}

async function procureSessionData(headers: Headers): Promise<string | null> {
  const setCookieHeader = headers.get('set-cookie');
  const sessionTokenChanged = setCookieHeader && setCookieHeader.includes('session_token');
  if (sessionTokenChanged) {
    // Delete session data cookie, if session_token cookie is deleted
    if (setCookieHeader.includes('max-age=0') ||
        setCookieHeader.includes('Max-Age=0')) {

      return `${NEON_AUTH_SESSION_DATA_COOKIE_NAME}=; ` +
        `Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
    }
    // Update session data cookie, if session_token cookie is refreshed
    else {
      try {
        const sessionData = await fetchSessionWithCookie(setCookieHeader);
        if (sessionData.session) {         
          const { value: signedData, expiresAt } = await signSessionDataCookie(sessionData);

          return `${NEON_AUTH_SESSION_DATA_COOKIE_NAME}=${signedData}; ` +
            `Path=/; HttpOnly; Secure; SameSite=Lax; ` +
            `Expires=${expiresAt.toUTCString()}`;
        }
      } catch (error) {
        // Session data creation failed - log but don't break the response
        console.error('Failed to create session data cookie:', error);
      }
    }
  }
  return null
}

async function fetchSessionWithCookie(setCookieHeader: string): Promise<SessionData> {
  const baseUrl = process.env.NEON_AUTH_BASE_URL!;
  const parsedCookies = parseSetCookies(setCookieHeader);
  const sessionToken = parsedCookies.find(c => c.name.includes('session_token'));

  if (!sessionToken) {
    throw new Error('session_token not found in set-cookie header');
  }

  const response = await fetch(`${baseUrl}/get-session`, {
    headers: {
      Cookie: `${sessionToken.name}=${sessionToken.value}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch session data');
  }

  const body = await response.json();
  return parseSessionData(body);
}