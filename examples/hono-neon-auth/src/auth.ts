import { createNeonAuth } from '@neondatabase/auth/hono/server';

if (!process.env.NEON_AUTH_BASE_URL) {
  throw new Error('NEON_AUTH_BASE_URL is required (see .env.example)');
}
if (!process.env.NEON_AUTH_COOKIE_SECRET) {
  throw new Error('NEON_AUTH_COOKIE_SECRET is required (min 32 chars)');
}

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET,
    // Uncomment for cross-subdomain cookie sharing:
    // domain: '.example.com',
  },
});
