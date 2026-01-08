import { createClient } from '@neondatabase/neon-js';
import type { Database } from './database.types';

// Default URLs for local development - override with VITE_* env vars for CI/staging
const DEFAULT_AUTH_URL =
  'https://ep-broad-wave-ah1vzqk8.neonauth.c-3.us-east-1.aws.neon.tech/neondb/auth';
const DEFAULT_DATA_API_URL =
  'https://ep-broad-wave-ah1vzqk8.apirest.c-3.us-east-1.aws.neon.tech/neondb/rest/v1';

export const neonClient = createClient<Database>({
  auth: {
    url: import.meta.env.VITE_NEON_AUTH_URL || DEFAULT_AUTH_URL,
    allowAnonymous: true,
  },
  dataApi: {
    url: import.meta.env.VITE_NEON_DATA_API_URL || DEFAULT_DATA_API_URL,
  },
});

// // local test
// export const neonClient = createClient({
//   auth: {
//     url: 'https://ep-floral-snow-52713923.neonauth.localtest.me:30443/neondb/auth',
//     allowAnonymous: true,
//   },
//   dataApi: {
//     url: 'https://ep-floral-snow-52713923.apirest.localtest.me:9443/neondb/rest/v1',
//   },
// });
