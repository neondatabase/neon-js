import { authApiHandler } from '@neondatabase/auth/next/server';

export const { GET, POST } = authApiHandler({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookieSecret: process.env.NEON_AUTH_COOKIE_SECRET!,
});
