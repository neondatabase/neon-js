import { BetterAuthVueAdapter } from '../adapters/better-auth-vue/better-auth-vue-adapter';
import { createAuthClient as createNeonAuthClient } from '../neon-auth';
import type { VueBetterAuthClient } from '../types';

/**
 * Creates a Vue Better Auth client that targets the same-origin
 * `/api/auth` Nuxt server route.
 */
export function createAuthClient(): VueBetterAuthClient {
  // @ts-expect-error - the same-origin Nuxt proxy does not need a base URL
  return createNeonAuthClient(undefined, {
    adapter: BetterAuthVueAdapter(),
  });
}

export {
  BetterAuthVueAdapter,
  type BetterAuthVueAdapterBuilder,
  type BetterAuthVueAdapterInstance,
  type BetterAuthVueAdapterOptions,
} from '../adapters/better-auth-vue/better-auth-vue-adapter';

export type { VueBetterAuthClient } from '../types';

export {
  AuthError,
  AuthApiError,
  isAuthError,
  isAuthApiError,
} from '../adapters/supabase/auth-interface';
