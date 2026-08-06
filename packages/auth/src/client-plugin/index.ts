import type { BetterAuthClientPlugin } from 'better-auth/client';
import type { BetterFetch } from '@better-fetch/fetch';
import { initBroadcastChannel } from '../core/better-auth-methods';
import { anonymousTokenResponseSchema } from '../plugins/anonymous-token';
import { neonFetchPlugin } from './fetch-hooks';

/**
 * Neon Auth Better Auth client plugin.
 *
 * Drop into any stock `better-auth/client` or `better-auth/react`
 * `createAuthClient` plugin list and the resulting client will have every
 * Neon-specific behavior the `@neondatabase/auth` wrapper provides today:
 *
 *  - cross-tab session sync (via `initBroadcastChannel`)
 *  - per-method `BETTER_AUTH_METHODS_HOOKS` onRequest / onSuccess routing
 *    (session-cache write, signOut clears in-flight cache + cross-tab
 *    broadcast, anonymous-token cache, JWT capture from `set-auth-jwt`)
 *  - OAuth verifier query-param forwarding into outbound `/get-session`
 *  - actions on the auth client root:
 *      - `getAnonymousToken()`   GET `/token/anonymous`
 *      - `getJWTToken()`         GET `/token` (with cached-session fast path
 *        + optional anonymous fallback)
 *      - `handleOAuthCallback()` explicit `/get-session?neon_auth_session_verifier=…`
 *
 * Three Neon behaviors that need the request/response only — not a fetch
 * wrap — live directly on `neonFetchPlugin` hooks and therefore work with
 * just `plugins: [neonClient()]`:
 *
 *  - `injectClientInfo` headers on every outbound (`onRequest`)
 *  - `normalizeBetterAuthError` of non-OK responses to a typed
 *    `AuthApiError` / `AuthError` (`onError`)
 *  - `set-auth-jwt` capture into the cached session token (`onSuccess`)
 *
 * Two Neon behaviors require wrapping the underlying `fetch` and therefore
 * need the companion `customFetchImpl`:
 *
 *  - body-aware in-flight deduplication
 *  - `X-Force-Fetch` escape hatch
 *
 * Three tiers of consumer boilerplate:
 *
 * ```ts
 * // Tier 1 — every Neon behavior except dedup + force-fetch
 * import { neonClient } from '@neondatabase/auth/client-plugin';
 * const client = createAuthClient({
 *   baseURL: 'https://auth.neon.tech',
 *   plugins: [neonClient()],
 * });
 *
 * // Tier 2 — Tier 1 plus the legacy `{ data, error }` envelope shape
 * const client = createAuthClient({
 *   baseURL: 'https://auth.neon.tech',
 *   plugins: [neonClient()],
 *   fetchOptions: { throw: false },
 * });
 *
 * // Tier 3 — Tier 2 plus body-aware dedup + X-Force-Fetch
 * import { neonClient, createNeonCustomFetchImpl }
 *   from '@neondatabase/auth/client-plugin';
 * const client = createAuthClient({
 *   baseURL: 'https://auth.neon.tech',
 *   plugins: [neonClient()],
 *   fetchOptions: {
 *     throw: false,
 *     customFetchImpl: createNeonCustomFetchImpl(),
 *   },
 * });
 * ```
 */

const NEON_AUTH_SESSION_VERIFIER_PARAM_NAME = 'neon_auth_session_verifier';
const ANONYMOUS_TOKEN_ENDPOINT = '/token/anonymous';
const GET_SESSION_ENDPOINT = '/get-session';

const readVerifierFromWindow = (): string | null => {
  if (typeof globalThis.window === 'undefined') {
    return null;
  }
  try {
    return new URL(globalThis.location.href).searchParams.get(
      NEON_AUTH_SESSION_VERIFIER_PARAM_NAME
    );
  } catch {
    return null;
  }
};

export interface NeonAnonymousTokenResponse {
  token: string;
  expires_at: number;
}

export interface NeonJWTTokenResponse {
  token: string;
}

interface BetterAuthSessionLike {
  session?: { token?: string } | null;
}

export const neonClient = () => {
  // Cross-tab session sync. Idempotent: subsequent calls re-subscribe but the
  // first invocation also handles OAuth-popup completion (postMessage +
  // window.close), so running this at plugin construction is correct for
  // both the wrapper and standalone consumers.
  initBroadcastChannel();

  return {
    id: 'neon',
    // Anonymous-token endpoint is GET; inherit pathMethods from the legacy
    // anonymousTokenClient so server-plugin path inference still maps it.
    pathMethods: {
      [ANONYMOUS_TOKEN_ENDPOINT]: 'GET',
    },
    fetchPlugins: [neonFetchPlugin],
    getActions: ($fetch: BetterFetch) => ({
      /**
       * GET `/token/anonymous` — short-lived RLS token for unauthenticated
       * users. Response is validated against `anonymousTokenResponseSchema`.
       */
      getAnonymousToken: async () => {
        return $fetch<NeonAnonymousTokenResponse>(ANONYMOUS_TOKEN_ENDPOINT, {
          method: 'GET',
        });
      },

      /**
       * Returns a JWT for the current session.
       *
       *  - First tries the BA-cached session (populated by the `set-auth-jwt`
       *    capture in `neonFetchPlugin`) so this is a synchronous read in
       *    the happy path.
       *  - Falls back to GET `/token`.
       *  - When `allowAnonymous` is true and no session exists, falls back
       *    to `getAnonymousToken()`.
       *
       * Returns `null` when no token is available.
       */
      getJWTToken: async (allowAnonymous = false): Promise<string | null> => {
        const sessionResponse = await $fetch<BetterAuthSessionLike>(
          GET_SESSION_ENDPOINT,
          {
            method: 'GET',
          }
        );
        const session = (sessionResponse as { data?: BetterAuthSessionLike })
          .data;
        const cachedToken = session?.session?.token;
        if (cachedToken) {
          return cachedToken;
        }

        if (allowAnonymous) {
          const anon = await $fetch<NeonAnonymousTokenResponse>(
            ANONYMOUS_TOKEN_ENDPOINT,
            { method: 'GET' }
          );
          const parsed = anonymousTokenResponseSchema.safeParse(
            (anon as { data?: unknown }).data
          );
          return parsed.success ? parsed.data.token : null;
        }

        return null;
      },

      /**
       * If the current page URL contains a `neon_auth_session_verifier`,
       * call `/get-session?neon_auth_session_verifier=…` to finalize the
       * OAuth / magic-link redirect. Returns `null` on the server or when
       * no verifier is present.
       */
      handleOAuthCallback: async () => {
        const verifier = readVerifierFromWindow();
        if (!verifier) {
          return null;
        }
        return $fetch(GET_SESSION_ENDPOINT, {
          method: 'GET',
          query: {
            [NEON_AUTH_SESSION_VERIFIER_PARAM_NAME]: verifier,
          },
        });
      },
    }),
  } satisfies BetterAuthClientPlugin;
};

export type NeonClientPlugin = ReturnType<typeof neonClient>;

export {
  createNeonCustomFetchImpl,
  FORCE_FETCH_HEADER,
} from './custom-fetch';

/**
 * Re-export the typed error classes thrown by `neonFetchPlugin.hooks.onError`
 * so plugin-only consumers can narrow with `instanceof` without depending on
 * `@neondatabase/auth/server` or the wrapper sub-path.
 */
export {
  AuthError,
  AuthApiError,
  isAuthError,
  isAuthApiError,
} from '../adapters/supabase/auth-interface';
