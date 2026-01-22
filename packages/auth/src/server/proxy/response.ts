import { signSessionDataCookie } from '../session';
import { NEON_AUTH_SESSION_DATA_COOKIE_NAME } from '@/server/constants';
import { parseSetCookies } from '../utils/cookies';
import type { SessionData } from '@/server/types';
import { parseSessionData } from '../session/operations';

// Allowlist of response headers that we want to proxy to the client from Neon Auth.
const RESPONSE_HEADERS_ALLOWLIST = ['content-type', 'content-length', 'content-encoding', 'transfer-encoding',
    'connection', 'date',
   'set-cookie', 'set-auth-jwt', 'set-auth-token', 'x-neon-ret-request-id'];

/**
 * Handles responses from upstream Neon Auth server
 * - Proxies allowed headers to client
 * - Mints session data cookie if session token is present
 *
 * @param response - Response from upstream Neon Auth server
 * @param config - Configuration including base URL and cookie secret
 * @returns New Response with proxied headers and session data cookie
 */
export const handleAuthResponse = async (
  response: Response,
  config: { baseUrl: string; cookieSecret: string }
) => {
  const responseHeaders = prepareResponseHeaders(response);

  // Mint session data cookie from upstream response
  const sessionDataCookie = await mintSessionData(response.headers, config.baseUrl, config.cookieSecret);
  if (sessionDataCookie) {
    // Use append to preserve existing Set-Cookie headers from upstream
    responseHeaders.append('Set-Cookie', sessionDataCookie);
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
    // Special handling for set-cookie: HTTP allows multiple Set-Cookie headers
    if (header === 'set-cookie') {
      // Use getSetCookie() to get all Set-Cookie headers as array
      const cookies = response.headers.getSetCookie();
      for (const cookie of cookies) {
        headers.append('Set-Cookie', cookie);
      }
    } else {
      const value = response.headers.get(header);
      if (value) {
        headers.set(header, value);
      }
    }
  }
  return headers;
}

async function mintSessionData(
  headers: Headers,
  baseUrl: string,
  cookieSecret: string
): Promise<string | null> {
  const setCookieHeaders = headers.getSetCookie();
  const sessionToken = setCookieHeaders.find(cookie => cookie.includes('session_token'));

  if (!sessionToken) {
    return null;
  }

  // Delete session data cookie if session_token cookie is deleted (case-insensitive check)
  const sessionCookie = sessionToken.toLowerCase();
  if (sessionCookie.includes('max-age=0')) {
    return `${NEON_AUTH_SESSION_DATA_COOKIE_NAME}=; ` +
      `Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
  }

  // Update session data cookie if session_token cookie is refreshed
  try {
    const sessionData = await fetchSessionWithCookie(sessionToken, baseUrl);

    if (sessionData.session) {
      const { value: signedData, expiresAt } = await signSessionDataCookie(sessionData, cookieSecret);

      return `${NEON_AUTH_SESSION_DATA_COOKIE_NAME}=${signedData}; ` +
        `Path=/; HttpOnly; Secure; SameSite=Lax; ` +
        `Expires=${expiresAt.toUTCString()}`;
    }
  } catch (error) {
    // Categorize error for better debugging
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorContext = {
      error: errorMessage,
      setCookieHeaderLength: sessionToken?.length || 0,
    };

    if (errorMessage.includes('session_token not found')) {
      console.warn('[procureSessionData] Session token missing in set-cookie:', errorContext);
    } else if (errorMessage.includes('Failed to fetch session data')) {
      console.error('[procureSessionData] Upstream /get-session request failed:', errorContext);
    } else if (errorMessage.includes('NEON_AUTH_COOKIE_SECRET')) {
      console.error('[procureSessionData] Cookie secret configuration error:', errorContext);
    } else if (errorMessage.includes('Invalid date')) {
      console.error('[procureSessionData] Date parsing error:', errorContext);
    } else {
      console.error('[procureSessionData] Unexpected error:', {
        ...errorContext,
        ...(process.env.NODE_ENV !== 'production' && {
          stack: error instanceof Error ? error.stack : undefined,
        }),
      });
    }
  }

  // Return null on error - upstream response will still be returned to client
  // Session cache will be skipped but auth still works
  return null;
}

async function fetchSessionWithCookie(
  setCookieHeader: string,
  baseUrl: string
): Promise<SessionData> {
  const parsedCookies = parseSetCookies(setCookieHeader);
  const sessionToken = parsedCookies.find(c => c.name.includes('session_token'));

  if (!sessionToken) {
    throw new Error('session_token not found in set-cookie header');
  }

  const response = await fetch(`${baseUrl}/get-session`, {
    headers: {
      Cookie: `${sessionToken.name}=${sessionToken.value}`,
    },
    signal: AbortSignal.timeout(3000), // 3s timeout
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch session data: ${response.status} ${response.statusText}`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    throw new Error(`Failed to parse /get-session response as JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  return parseSessionData(body);
}
