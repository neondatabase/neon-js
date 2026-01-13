import { createAuthClient } from '@neondatabase/neon-js/auth';
import { BetterAuthReactAdapter } from '@neondatabase/neon-js/auth/react';

// Default URLs for local development - override with VITE_* env vars for CI/staging
const DEFAULT_AUTH_URL =
  'https://ep-broad-wave-ah1vzqk8.neonauth.c-3.us-east-1.aws.neon.tech/neondb/auth';

export const neonAuthClient = createAuthClient(
  import.meta.env.VITE_NEON_AUTH_URL || DEFAULT_AUTH_URL,
  {
    adapter: BetterAuthReactAdapter(),
  }
);
