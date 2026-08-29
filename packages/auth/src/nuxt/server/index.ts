import type { H3Event } from 'h3';
import {
  createAuthServer,
  resolveNeonAuthLogging,
  validateCookieConfig,
  type NeonAuthConfig,
  type NeonAuthServer,
} from '../../server';
import { createNuxtRequestContext } from './adapter';
import { authApiHandler } from './handler';
import {
  neonAuthMiddleware,
  type NuxtAuthMiddlewareOptions,
} from './middleware';

/**
 * Unified Neon Auth entry point for Nuxt 4 and Nitro.
 *
 * Server methods are exposed through `withEvent(event)` so every proxy is
 * explicitly bound to one H3 request. The adapter cannot use Nuxt application
 * auto-imports or Node-only request storage across every Nitro preset.
 */
export function createNeonAuth(config: NeonAuthConfig): NeonAuth {
  const { baseUrl, cookies } = config;

  validateCookieConfig(cookies);
  const log = resolveNeonAuthLogging(config);
  const proxyConfig = {
    baseUrl,
    cookieSecret: cookies.secret,
    sessionDataTtl: cookies.sessionDataTtl,
    domain: cookies.domain,
    sameSite: cookies.sameSite,
    log,
  };

  return {
    withEvent(event) {
      return createAuthServer({
        baseUrl,
        context: () => createNuxtRequestContext(event),
        cookieSecret: cookies.secret,
        sessionDataTtl: cookies.sessionDataTtl,
        domain: cookies.domain,
        sameSite: cookies.sameSite,
        log,
      });
    },

    handler() {
      return authApiHandler(proxyConfig);
    },

    middleware(options) {
      return neonAuthMiddleware({
        ...proxyConfig,
        ...options,
      });
    },
  };
}

export interface NeonAuth {
  /** Bind all Better Auth server methods to a single H3 request event. */
  withEvent(event: H3Event): NeonAuthServer;
  /** Create the `/api/auth/[...path]` Nitro route handler. */
  handler(): ReturnType<typeof authApiHandler>;
  /** Create Nitro route-protection middleware. */
  middleware(
    options?: NuxtAuthMiddlewareOptions
  ): ReturnType<typeof neonAuthMiddleware>;
}

export type { NuxtAuthMiddlewareOptions } from './middleware';

export {
  AuthError,
  AuthApiError,
  isAuthError,
  isAuthApiError,
} from '../../adapters/supabase/auth-interface';

export {
  resolveNeonAuthLogging,
  type NeonAuthLogger,
  type NeonAuthLogLevel,
  type NeonAuthLoggingInput,
  type ResolvedNeonAuthLogging,
} from '../../server/logger';

export {
  NEON_AUTH_NETWORK_ERROR_CODES,
  classifyFetchFailure,
  type NeonAuthNetworkErrorCode,
  type ClassifiedFetchFailure,
} from '../../server/network-error';

export type { NeonAuthServerApiError } from '../../server/types';
