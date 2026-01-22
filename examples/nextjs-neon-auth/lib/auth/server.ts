import { createAuthServer } from '@neondatabase/auth/next/server';

export const authServer = createAuthServer({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookieSecret: process.env.NEON_AUTH_COOKIE_SECRET!,
});
