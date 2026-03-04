import { mintSessionDataFromResponse } from '../session/minting';
import { parseSetCookies, serializeSetCookie } from '@/server/utils/cookies';
import type { SessionCookieConfig } from '../config';

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
 * @param baseUrl - Base URL of Neon Auth server
 * @param cookieConfig - Session cookie configuration
 * @returns New Response with proxied headers and session data cookie
 */
export const handleAuthResponse = async (
  response: Response,
  baseUrl: string,
  cookieConfig: SessionCookieConfig
) => {
  const responseHeaders = prepareResponseHeaders(response, cookieConfig.domain);

  // Mint session data cookie from upstream response
  const sessionDataCookie = await mintSessionDataFromResponse(response.headers, baseUrl, cookieConfig);
  if (sessionDataCookie) {
    responseHeaders.append('Set-Cookie', sessionDataCookie);
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
        // Parse and add domain if specified
        if (domain) {
          const parsedCookies = parseSetCookies(cookieHeader);
          for (const parsedCookie of parsedCookies) {
            parsedCookie.domain = domain;
            headers.append('Set-Cookie', serializeSetCookie(parsedCookie));
          }
        } else {
          headers.append('Set-Cookie', cookieHeader);
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
