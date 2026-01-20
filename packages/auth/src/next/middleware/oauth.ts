import { NextResponse, type NextRequest } from 'next/server';
import { NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME } from '../constants';
import { handleAuthRequest } from '../handler/request';
import { handleAuthResponse } from '../handler/response';
import { extractResponseCookies } from '../auth/cookies';
import { NEON_AUTH_SESSION_VERIFIER_PARAM_NAME } from '../../core/constants';

export const needsSessionVerification = (request: NextRequest) => {
  const url = request.nextUrl;
  const hasVerifier = url.searchParams.has(
    NEON_AUTH_SESSION_VERIFIER_PARAM_NAME
  );
  const hasChallenge = request.cookies.get(
    NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME
  );

  return hasVerifier && hasChallenge;
};

export const exchangeOAuthToken = async (
  request: NextRequest,
  baseUrl: string,
  cookieSecret?: string
) => {
  const url = request.nextUrl;
  const verifier = url.searchParams.get(NEON_AUTH_SESSION_VERIFIER_PARAM_NAME);
  const challenge = request.cookies.get(
    NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME
  );

  if (!verifier || !challenge) {
    return null;
  }

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
    const headers = new Headers();
    const cookies = extractResponseCookies(response.headers);
    for (const cookie of cookies) {
      headers.append('Set-Cookie', cookie);
    }

    url.searchParams.delete(NEON_AUTH_SESSION_VERIFIER_PARAM_NAME);
    return NextResponse.redirect(url, {
      headers,
    });
  }
  return null;
};
