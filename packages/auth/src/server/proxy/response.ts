import { mintSessionDataFromResponse } from '../session/minting';
import { maybeRefreshSessionDataAfterResponse } from '../session/post-response-refresh';
import { parseSetCookies, serializeSetCookie } from '@/server/utils/cookies';
import type { SessionCookieConfig } from '../config';

// Allowlist of response headers that we want to proxy to the client from Neon Auth.
const RESPONSE_HEADERS_ALLOWLIST = ['content-type', 'content-length', 'content-encoding', 'transfer-encoding',
    'connection', 'date',
   'set-cookie', 'set-auth-jwt', 'set-auth-token', 'x-neon-ret-request-id'];

export interface AuthResponseRequestContext {
  /** Raw Cookie header from the inbound request, used to locate session_token for post-response refresh. */
  cookieHeader: string | null;
}

/**
 * Handles responses from upstream Neon Auth server
 * - Proxies allowed headers to client
 * - Mints session data cookie if session token is present
 * - Optionally refreshes session data cookie if mutation response body carries fresh user/session
 *
 * @param response - Response from upstream Neon Auth server
 * @param baseUrl - Base URL of Neon Auth server
 * @param cookieConfig - Session cookie configuration
 * @param requestContext - Optional inbound request context for post-response refresh
 * @returns New Response with proxied headers and session data cookie
 */
export const handleAuthResponse = async (
  response: Response,
  baseUrl: string,
  cookieConfig: SessionCookieConfig,
  requestContext?: AuthResponseRequestContext
) => {
  const responseHeaders = prepareResponseHeaders(response, cookieConfig.domain);

  // Mint session data cookie from upstream response
  const sessionDataCookie = await mintSessionDataFromResponse(response.headers, baseUrl, cookieConfig);
  if (sessionDataCookie) {
    responseHeaders.append('Set-Cookie', sessionDataCookie);
  }

  // Fallback refresh: covers mutation routes (update-user, phone-number/verify, etc.)
  // where upstream returns fresh user/session in the body without rotating session_token.
  if (requestContext) {
    const fallback = await maybeRefreshSessionDataAfterResponse({
      requestCookieHeader: requestContext.cookieHeader,
      response,
      baseUrl,
      cookieConfig,
      alreadyMintedFromHeader: sessionDataCookie !== null,
    });
    if (fallback) {
      responseHeaders.append('Set-Cookie', fallback);
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}

const prepareResponseHeaders = (response: Response, domain?: string) => {
  const headers = new Headers();
  for (const header of RESPONSE_HEADERS_ALLOWLIST) {
    // Special handling for set-cookie: HTTP allows multiple Set-Cookie headers
    if (header === 'set-cookie') {
      const cookies = response.headers.getSetCookie();
      for (const cookieHeader of cookies) {
        // Always sanitize upstream cookie flags before forwarding to the browser:
        // - Strip Partitioned: Safari does not send Partitioned cookies on top-level navigations,
        //   which breaks the OAuth challenge exchange when the callback hits a middleware route.
        //   The flag is also only meaningful for third-party contexts; proxied cookies are first-party.
        // - Force SameSite=Lax: upstream sends SameSite=None (required alongside Partitioned).
        //   Lax is correct for first-party cookies and safe for cross-subdomain use — subdomains
        //   share the same registrable domain (eTLD+1) and are considered same-site by browsers.
        // Domain assignment is the only conditional step.
        const parsedCookies = parseSetCookies(cookieHeader);
        for (const parsedCookie of parsedCookies) {
          parsedCookie.partitioned = undefined;
          parsedCookie.sameSite = 'lax';
          if (domain) {
            parsedCookie.domain = domain;
          }
          headers.append('Set-Cookie', serializeSetCookie(parsedCookie));
        }
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
