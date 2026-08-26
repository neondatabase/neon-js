import { createNeonAuth } from '@neondatabase/auth/nuxt/server';
import type { H3Event } from 'h3';

export function createEventAuth(event: H3Event) {
  const config = useRuntimeConfig(event);

  if (!config.neonAuthBaseUrl || !config.neonAuthCookieSecret) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Neon Auth runtime configuration is incomplete',
    });
  }

  return createNeonAuth({
    baseUrl: config.neonAuthBaseUrl,
    cookies: {
      secret: config.neonAuthCookieSecret,
      sessionDataTtl: 300,
      domain: config.cookieDomain || undefined,
    },
  });
}

export function useEventAuth(event: H3Event) {
  return createEventAuth(event).withEvent(event);
}

export async function requireUser(event: H3Event) {
  const result = await useEventAuth(event).getSession();

  if (!result.data?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    });
  }

  return result.data;
}
