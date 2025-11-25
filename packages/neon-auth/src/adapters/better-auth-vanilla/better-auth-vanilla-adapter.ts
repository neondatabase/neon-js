import {
  type BetterAuthClientOptions,
  createAuthClient,
} from 'better-auth/client';

import {
  NeonAuthAdapterCore,
  type NeonAuthAdapterCoreAuthOptions,
} from '../../core/adapter-core';
import type { AuthClient } from 'better-auth/client';

export type BetterAuthVanillaAdapterOptions = NeonAuthAdapterCoreAuthOptions;

export class BetterAuthVanillaAdapter extends NeonAuthAdapterCore {
  private _betterAuth: AuthClient<BetterAuthClientOptions>;

  constructor(betterAuthClientOptions: BetterAuthVanillaAdapterOptions) {
    super(betterAuthClientOptions);
    this._betterAuth = createAuthClient(this.betterAuthOptions);
  }
  getBetterAuthInstance(): AuthClient<BetterAuthClientOptions> {
    return this._betterAuth;
  }
  async getJWTToken() {
    const session = await this._betterAuth.getSession();
    if (session.error) {
      throw session.error;
    }
    return session.data?.session?.token ?? null;
  }
}
