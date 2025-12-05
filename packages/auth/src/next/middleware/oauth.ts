import { NextResponse, type NextRequest } from 'next/server';
import {
  NEON_AUTH_SESSION_COOKIE_NAME,
  NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME,
  NEON_AUTH_SESSION_VERIFIER_PARAM_NAME,
} from '../constants';
import { handleAuthRequest } from '../handler/request';
import { handleAuthResponse } from '../handler/response';

export const needsSessionVerification = (request: NextRequest) => {
  const url = request.nextUrl;
  const hasVerifier = url.searchParams.has(
    NEON_AUTH_SESSION_VERIFIER_PARAM_NAME
  );
  const hasChallenge = request.cookies.get(
    NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME
  );
  const hasSession = request.cookies.get(NEON_AUTH_SESSION_COOKIE_NAME);

  return hasVerifier && hasChallenge && !hasSession;
};

export const verifySession = async (request: NextRequest, baseUrl: string) => {
  const url = request.nextUrl;
  const verifier = url.searchParams.get(NEON_AUTH_SESSION_VERIFIER_PARAM_NAME);
  const challenge = request.cookies.get(
    NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME
  );

  if (!verifier || !challenge) {
    return null;
  }

  const response = await getSession(request, baseUrl);
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

const getSession = async (request: NextRequest, baseUrl: string) => {
  const upstreamRequest = new Request(request.url, {
    method: 'GET',
    headers: request.headers,
    body: null,
  });
  const response = await handleAuthRequest(
    baseUrl,
    upstreamRequest,
    'get-session'
  );
  return handleAuthResponse(response);
};

const extractResponseCookies = (headers: Headers) => {
  const cookieHeader = headers.get('set-cookie');
  if (!cookieHeader) return [];

  return cookieHeader.split(', ').map((c) => c.trim());
};
