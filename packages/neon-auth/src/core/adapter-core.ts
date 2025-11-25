import {
  type AuthClient,
  type BetterAuthClientOptions,
} from 'better-auth/client';
import type { createAuthClient } from 'better-auth/react';

import {
  jwtClient,
  adminClient,
  organizationClient,
  emailOTPClient,
  magicLinkClient,
  phoneNumberClient,
} from 'better-auth/client/plugins';
import {
  BETTER_AUTH_METHODS_HOOKS,
  BETTER_AUTH_METHODS_IN_FLIGHT_REQUESTS,
  deriveBetterAuthMethodFromUrl,
} from './better-auth-methods';

export interface NeonAuthAdapterCoreAuthOptions
  extends Omit<BetterAuthClientOptions, 'plugins'> {}

const defaultBetterAuthClientOptions = {
  plugins: [
    jwtClient(),
    adminClient(),
    organizationClient(),
    emailOTPClient(),

    // TODO: add these in
    phoneNumberClient(),
    magicLinkClient(),
  ],
} satisfies BetterAuthClientOptions;

export abstract class NeonAuthAdapterCore {
  protected betterAuthOptions: BetterAuthClientOptions;

  /**
   * Better Auth adapter implementing the NeonAuthClient interface.
   * See CLAUDE.md for architecture details and API mappings.
   */

  //#region Constructor
  constructor(betterAuthClientOptions: NeonAuthAdapterCoreAuthOptions) {
    // Preserve user's onSuccess callback if they provided one
    const userOnSuccess = betterAuthClientOptions.fetchOptions?.onSuccess;
    const userOnRequest = betterAuthClientOptions.fetchOptions?.onRequest;

    this.betterAuthOptions = {
      ...betterAuthClientOptions,
      ...defaultBetterAuthClientOptions,
      fetchOptions: {
        ...betterAuthClientOptions.fetchOptions,
        onRequest: (request) => {
          const url = request.url;
          const method = deriveBetterAuthMethodFromUrl(url.toString());
          if (method) {
            BETTER_AUTH_METHODS_HOOKS[method].onRequest();
          }

          userOnRequest?.(request);
        },
        customFetchImpl: async (url, init) => {
          // Skip deduplication if X-Force-Fetch header is present
          if (init?.headers && 'X-Force-Fetch' in init.headers) {
            const headers = { ...init.headers };
            delete headers['X-Force-Fetch'];
            console.log('[customFetch] Force-fetch bypass:', url);
            return fetch(url, { ...init, headers });
          }

          // Create body-aware deduplication key
          const method = init?.method || 'GET';
          const body = init?.body || '';
          const key = `${method}:${url}:${body}`;

          const response =
            await BETTER_AUTH_METHODS_IN_FLIGHT_REQUESTS.deduplicate(key, () =>
              fetch(url, init)
            );

          // Clone the response so each caller gets a fresh body stream
          // (Response bodies can only be read once, but deduplication shares the same Response)
          return response.clone();
        },
        onSuccess: async (ctx) => {
          // Capture JWT from any request that includes it
          const jwt = ctx.response.headers.get('set-auth-jwt');
          if (jwt) {
            // Inject JWT into response data BEFORE Better Auth processes it.
            // Better Auth will then update its internal state, triggering useSession.subscribe()
            // which will cache the session with JWT included (single cache-setting point).
            if (ctx.data?.session) {
              console.log('[onSuccess] Injecting JWT into session.token');
              ctx.data.session.token = jwt;
            } else {
              console.warn(
                '[onSuccess] JWT found but no session data to inject into!'
              );
            }
          }

          const url = ctx.request.url.toString();
          const responseData = ctx.data;

          // Detect sign-in/sign-up
          const method = deriveBetterAuthMethodFromUrl(url);
          if (method) {
            BETTER_AUTH_METHODS_HOOKS[method].onSuccess(responseData);
          }

          // Call user's onSuccess callback if they provided one
          await userOnSuccess?.(ctx);
        },
      },
    };
  }

  abstract getBetterAuthInstance?():
    | AuthClient<BetterAuthClientOptions>
    | ReturnType<typeof createAuthClient>;
  abstract getJWTToken(): Promise<string | null>;
}
