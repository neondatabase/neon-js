import { neonAuthMiddleware } from "@neondatabase/neon-js/auth/next";

export default neonAuthMiddleware({
  // Redirects unauthenticated users to sign-in page
  loginUrl: "/auth/sign-in",
});

export const config = {
  matcher: [
    // Protected routes requiring authentication
    "/account/:path*",

    // Do not run the auth middleware for static files, images, and favicon.ico
    "/((?!_next/static|_next/image|favicon.ico|).*)",
  ],
};