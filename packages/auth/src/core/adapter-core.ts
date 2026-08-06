import { type BetterAuthClientOptions } from 'better-auth/client';

import {
  jwtClient,
  adminClient,
  emailOTPClient,
  magicLinkClient,
  organizationClient,
  phoneNumberClient,
} from 'better-auth/client/plugins';
import { neonClient } from '../client-plugin';
import {
  createNeonCustomFetchImpl,
  
} from '../client-plugin/custom-fetch';
import type { BetterAuthInstance } from '../types';

export interface NeonAuthAdapterCoreAuthOptions extends Omit<
  BetterAuthClientOptions,
  'plugins'
> {}



const supportedBetterAuthClientPlugins = [
  jwtClient(),
  adminClient(),
  organizationClient(),
  emailOTPClient(),
  magicLinkClient(),
  phoneNumberClient(),
  // `neonClient()` is the single source of truth for every Neon-specific
  // client-side behavior: it installs the per-method onRequest/onSuccess
  // fetch hooks (session-cache + cross-tab sync + JWT capture), exposes the
  // `getAnonymousToken` / `getJWTToken` / `handleOAuthCallback` actions, and
  // calls `initBroadcastChannel()` at construction.
  neonClient(),
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
   *
   * All Neon-specific behaviors (per-method hooks, cross-tab sync, JWT
   * capture, anonymous token, verifier forwarding, force-fetch escape
   * hatch, in-flight dedup, error normalization, client-info injection)
   * are installed via the shared `neonClient()` plugin and
   * `createNeonCustomFetchImpl()`, so a tenant who wires up stock
   * `better-auth/client` + `neonClient()` gets the same behavior as this
   * wrapper.
   */

  //#region Constructor
  constructor(betterAuthClientOptions: NeonAuthAdapterCoreAuthOptions) {
    const userFetchOptions = betterAuthClientOptions.fetchOptions ?? {};
    this.betterAuthOptions = {
      ...betterAuthClientOptions,
      plugins: supportedBetterAuthClientPlugins,
      fetchOptions: {
        ...userFetchOptions,
        throw: false,
        // Preserve any caller-supplied customFetchImpl by falling through to
        // ours only when they did not provide one. (In practice nobody does
        // — the wrapper is the only caller — but better safe than surprised.)
        customFetchImpl:
          userFetchOptions.customFetchImpl ?? createNeonCustomFetchImpl(),
      },
    };
  }

  abstract getBetterAuthInstance(): BetterAuthInstance;

  /**
   * Get JWT token for authenticated or anonymous access.
   * Single source of truth for token retrieval logic.
   *
   * @param allowAnonymous - When true, fetches anonymous token if no session exists
   * @returns JWT token string or null if unavailable
   */
  async getJWTToken(allowAnonymous: boolean): Promise<string | null> {
    const client = this.getBetterAuthInstance();

    // First, try to get authenticated session JWT
    const session = await client.getSession();
    if (session.data?.session?.token) {
      return session.data.session.token;
    }

    // No authenticated session - check if anonymous access is allowed
    if (allowAnonymous) {
      const anonymousTokenResponse = await client.getAnonymousToken();
      return anonymousTokenResponse.data?.token ?? null;
    }

    // Anonymous access disabled - return null
    return null;
  }
}

export {FORCE_FETCH_HEADER} from '../client-plugin/custom-fetch';