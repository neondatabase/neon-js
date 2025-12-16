import { neonAuthMiddleware } from "@neondatabase/neon-js/auth/next";

export default neonAuthMiddleware({
  // Redirects unauthenticated users to sign-in page
  loginUrl: "/client/auth/sign-in",
});

export const config = {
  matcher: [
    "/server/account",
    // Do not run the auth middleware for static files, images, and favicon.ico
    "/((?!_next/static|_next/image|favicon.ico|).*)",
  ],
};