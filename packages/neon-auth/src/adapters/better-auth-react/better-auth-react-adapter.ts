import { createAuthClient } from 'better-auth/react';
import {
  NeonAuthAdapterCore,
  type NeonAuthAdapterCoreAuthOptions,
} from '../../core/adapter-core';

export type BetterAuthReactAdapterOptions = NeonAuthAdapterCoreAuthOptions;

export class BetterAuthReactAdapter extends NeonAuthAdapterCore {
  private _betterAuth: ReturnType<typeof createAuthClient>;

  constructor(betterAuthClientOptions: BetterAuthReactAdapterOptions) {
    super(betterAuthClientOptions);
    this._betterAuth = createAuthClient(this.betterAuthOptions);
  }
  getBetterAuthInstance() {
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
