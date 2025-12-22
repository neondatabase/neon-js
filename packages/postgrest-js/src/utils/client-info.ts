import pkg from '../../package.json' with { type: 'json' };
import {
  createClientInfoInjector,
  getClientInfo as getClientInfoInternal,
} from '@neondatabase/internal';

// Duplicated to avoid external type imports in published declarations
export interface ClientInfo {
  sdk: string;
  version: string;
  runtime: string;
  runtimeVersion: string;
  platform: string;
  arch: string;
  framework?: string;
}

export const getClientInfo: (
  sdkName: string,
  sdkVersion: string
) => ClientInfo = getClientInfoInternal;

export const injectClientInfo = createClientInfoInjector(pkg.name, pkg.version);

export { X_NEON_CLIENT_INFO_HEADER } from '@neondatabase/internal';
