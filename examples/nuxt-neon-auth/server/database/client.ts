import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import type { H3Event } from 'h3';

import * as schema from './schema';

export function useDatabase(event: H3Event) {
  const { databaseUrl } = useRuntimeConfig(event);

  if (!databaseUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: 'NUXT_DATABASE_URL is not configured',
    });
  }

  return drizzle(neon(databaseUrl), { schema });
}
