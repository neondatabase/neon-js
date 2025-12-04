import {
  type AuthClient,
  type BetterAuthClientOptions,
} from 'better-auth/client';
import type { createAuthClient } from 'better-auth/react';

import {
  jwtClient,
  adminClient,
  emailOTPClient,
  magicLinkClient,
  phoneNumberClient,
  anonymousClient,
} from 'better-auth/client/plugins';
import {
  BETTER_AUTH_METHODS_HOOKS,
  BETTER_AUTH_METHODS_IN_FLIGHT_REQUESTS,
  deriveBetterAuthMethodFromUrl,
} from './better-auth-methods';

export interface NeonAuthAdapterCoreAuthOptions
  extends Omit<BetterAuthClientOptions, 'plugins'> {}

export const FORCE_FETCH_HEADER = 'X-Force-Fetch';

const supportedBetterAuthClientPlugins = [
  jwtClient(),
  adminClient(),

  // TODO: enable this when better auth fix is released
  // organizationClient(),
  emailOTPClient(),
  anonymousClient(),

  // TODO: add these in
  phoneNumberClient(),
  magicLinkClient(),
] satisfies BetterAuthClientOptions['plugins'];

export type SupportedBetterAuthClientPlugins =
  typeof supportedBetterAuthClientPlugins;

export abstract class NeonAuthAdapterCore {
  protected betterAuthOptions: BetterAuthClientOptions & {
    plugins: SupportedBetterAuthClientPlugins;
    fetchOptions: {
      throw: false;
    };
  };

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
      plugins: supportedBetterAuthClientPlugins,
      fetchOptions: {
        ...betterAuthClientOptions.fetchOptions,
        throw: false,
        onRequest: (request) => {
          const url = request.url;
          const method = deriveBetterAuthMethodFromUrl(url.toString());
          if (method) {
            BETTER_AUTH_METHODS_HOOKS[method].onRequest(request);
          }

          userOnRequest?.(request);
        },
        customFetchImpl: async (url, init) => {
          // Skip deduplication if X-Force-Fetch header is present
          if (init?.headers && FORCE_FETCH_HEADER in init.headers) {
            const headers = { ...init.headers };
            delete headers[FORCE_FETCH_HEADER];
            const response = await fetch(url, { ...init, headers });

            // Check for HTTP errors
            if (!response.ok) {
              const body = await response
                .clone()
                .json()
                .catch(() => ({}));
              const err = new Error(
                body.message || `HTTP ${response.status} ${response.statusText}`
              );
              (err as any).status = response.status;
              (err as any).statusText = response.statusText;
              throw err;
            }

            return response;
          }

          const betterAuthMethod = deriveBetterAuthMethodFromUrl(
            url.toString()
          );
          if (betterAuthMethod) {
            const response = await BETTER_AUTH_METHODS_HOOKS[
              betterAuthMethod
            ].beforeRequest?.(url, init);
            if (response) {
              return response;
            }
          }

          // Create body-aware deduplication key
          const method = init?.method || 'GET';
          const body = init?.body || '';
          const key = `${method}:${url}:${body}`;

          const response =
            await BETTER_AUTH_METHODS_IN_FLIGHT_REQUESTS.deduplicate(key, () =>
              fetch(url, init)
            );

          // Check for HTTP errors before returning
          if (!response.ok) {
            const errorBody = await response
              .clone()
              .json()
              .catch(() => ({}));
            const err = new Error(
              errorBody.message ||
                `HTTP ${response.status} ${response.statusText}`
            );
            (err as any).status = response.status;
            (err as any).statusText = response.statusText;
            throw err;
          }

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
