import { NextRequest, NextResponse } from "next/server";
import { NEXT_AUTH_SESION_COOKIE_NAME } from "../constants";

const AUTH_API_ROUTES = '/api/auth';
const SKIP_ROUTES = [
  AUTH_API_ROUTES,
  // Routes added by `neon-auth-ui`
  '/auth/callback',
  '/auth/sign-in',
  '/auth/sign-up',
  '/auth/magic-link',
  '/auth/email-otp',
  '/auth/forgot-password',
];

type NeonAuthMiddlewareOptions = {
  loginUrl?: string;
}

export const neonAuthMiddleware = ({ loginUrl = '/auth/sign-in' }: NeonAuthMiddlewareOptions = {}) => {

  return async (request: NextRequest) => {
    const { pathname } = request.nextUrl;

    // Always skip session check for login URL
    if (pathname.startsWith(loginUrl)) {
      return NextResponse.next();
    }

    if (SKIP_ROUTES.some(route => pathname.startsWith(route))) {
      return NextResponse.next();
    }
    const token = request.cookies.get(NEXT_AUTH_SESION_COOKIE_NAME);
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }
}