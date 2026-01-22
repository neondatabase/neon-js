import { neonAuthMiddleware } from "@neondatabase/auth/next/server";

export default neonAuthMiddleware({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookieSecret: process.env.NEON_AUTH_COOKIE_SECRET!,
  // Redirects unauthenticated users to sign-in page
  loginUrl: "/auth/sign-in",
});

export const config = {
  matcher: [
    // Protected routes requiring authentication
    "/account/:path*",
    "/organization/:path*",
    "/notes"
  ],
};