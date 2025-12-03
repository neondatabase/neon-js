import { NextRequest, NextResponse } from "next/server";
import { NEXT_AUTH_SESION_COOKIE_NAME } from "../constants";

const AUTH_API_ROUTES = '/api/auth';
const SKIP_ROUTES = [AUTH_API_ROUTES, '/auth/callback'];

export const neonAuthMiddleware = () => {

  return async (request: NextRequest) => {
    const { pathname } = request.nextUrl;
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