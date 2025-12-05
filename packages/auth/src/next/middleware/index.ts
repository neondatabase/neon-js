import { NextRequest, NextResponse } from 'next/server';
import { NEON_AUTH_SESSION_COOKIE_NAME } from '../constants';
import { needsSessionVerification, verifySession } from './oauth';

const AUTH_API_ROUTES = '/api/auth';
const SKIP_ROUTES = [
  AUTH_API_ROUTES,
  // Routes added by `auth-ui`
  '/auth/callback',
  '/auth/sign-in',
  '/auth/sign-up',
  '/auth/magic-link',
  '/auth/email-otp',
  '/auth/forgot-password',
];

type NeonAuthMiddlewareOptions = {
  /*
   *  The URL to redirect to when the user is not authenticated.
   *  Defaults to `/auth/sign-in`
   */
  loginUrl?: string;

  /**
   * The Neon Auth base URL
   *  Defaults to `process.env.NEON_AUTH_BASE_URL`
   *
   * If not provided, and if not in the environment, the middleware will throw an error.
   *
   * @throws {Error} If the authURL is not provided and not in the environment.
   */
  authBaseUrl?: string;
};

export const neonAuthMiddleware = ({
  loginUrl = '/auth/sign-in',
  authBaseUrl,
}: NeonAuthMiddlewareOptions) => {
  const baseURL = authBaseUrl || process.env.NEON_AUTH_BASE_URL;
  if (!baseURL) {
    throw new Error(
      'You must provide a Neon Auth base URL in the middleware options or in the environment variables'
    );
  }

  return async (request: NextRequest) => {
    const { pathname } = request.nextUrl;

    // Always skip session check for login URL to prevent infinite redirect loop
    if (pathname.startsWith(loginUrl)) {
      return NextResponse.next();
    }

    // For OAuth flow, the callback from Neon Auth will include a session verifier token in the query params.
    // We need to exchange the verifier token and session challenge for the session cookie
    const verification = needsSessionVerification(request);
    if (verification) {
      const response = await verifySession(request, baseURL);
      if (response !== null) {
        return response;
      }
    }

    if (SKIP_ROUTES.some((route) => pathname.startsWith(route))) {
      return NextResponse.next();
    }
    const token = request.cookies.get(NEON_AUTH_SESSION_COOKIE_NAME);
    if (!token) {
      return NextResponse.redirect(new URL(loginUrl, request.url));
    }
    return NextResponse.next();
  };
};
