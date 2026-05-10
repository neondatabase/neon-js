import { createNeonAuth } from '@neondatabase/auth/next/server';

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
    sessionDataTtl: 300,
  },
  // Opt-in: log proxy/middleware/server-API issues (e.g. synthetic 502s) at warn+error via console.
  // Omit `logLevel` / `logger` if you prefer no Neon Auth console output.
  logLevel: 'warn',
});
