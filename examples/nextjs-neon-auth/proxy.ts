import { auth } from "@/lib/auth/server";

export default auth.middleware({
  // Redirects unauthenticated users to sign-in page
  loginUrl: "/auth/sign-in",
});

export const config = {
  matcher: [
    // Protected routes requiring authentication
    "/account/:path*",
    "/organization/:path*",
    "/notes",
    // Login page: resumes a pending OAuth provider authorization for signed-in users
    "/auth/sign-in",
  ],
};