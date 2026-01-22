import { NEON_AUTH_SESSION_VERIFIER_PARAM_NAME } from '@/core/constants';
import { NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME } from '../constants';
import { handleAuthRequest, handleAuthResponse } from '../proxy';
import { parseCookies } from 'better-auth/cookies';

/**
 * Result of OAuth token exchange
 */
export interface OAuthExchangeResult {
  /** URL to redirect to after exchange (with verifier param removed) */
  redirectUrl: URL;
  /** Set-Cookie headers to include in redirect response */
  cookies: string[];
  /** Whether the exchange was successful */
  success: boolean;
}

/**
 * Checks if the current request needs OAuth session verification
 * This happens when returning from OAuth provider with a verifier token
 *
 * @param request - Standard Web API Request object
 * @returns true if session verification is needed
 */
export function needsSessionVerification(request: Request): boolean {
  const url = new URL(request.url);
  const hasVerifier = url.searchParams.has(NEON_AUTH_SESSION_VERIFIER_PARAM_NAME);

  // Check for challenge cookie
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return false;
  }

  const cookies = parseCookies(cookieHeader);
  const hasChallenge = cookies.has(NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME);

  return hasVerifier && hasChallenge;
}

/**
 * Exchanges OAuth verifier token for session cookie
 * This completes the OAuth flow by verifying the session challenge
 *
 * @param request - Standard Web API Request object
 * @param baseUrl - Base URL of Neon Auth server
 * @param cookieSecret - Secret for signing session cookies
 * @returns Exchange result with redirect URL and cookies, or null if exchange not needed/failed
 */
export async function exchangeOAuthToken(
  request: Request,
  baseUrl: string,
  cookieSecret: string
): Promise<OAuthExchangeResult | null> {
  const url = new URL(request.url);
  const verifier = url.searchParams.get(NEON_AUTH_SESSION_VERIFIER_PARAM_NAME);

  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return null;
  }

  const cookies = parseCookies(cookieHeader);
  const challenge = cookies.get(NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME);

  if (!verifier || !challenge) {
    return null;
  }

  // Make request to upstream to exchange verifier for session
  const upstreamRequest = new Request(request.url, {
    method: 'GET',
    headers: request.headers,
  });

  const upstreamResponse = await handleAuthRequest(
    baseUrl,
    upstreamRequest,
    'get-session'
  );

  const response = await handleAuthResponse(upstreamResponse, { baseUrl, cookieSecret });

  if (response.ok) {
    // Extract Set-Cookie headers from response
    const setCookieHeaders = response.headers.getSetCookie();

    // Remove verifier param from redirect URL
    url.searchParams.delete(NEON_AUTH_SESSION_VERIFIER_PARAM_NAME);

    return {
      redirectUrl: url,
      cookies: setCookieHeaders,
      success: true,
    };
  }

  return null;
}
