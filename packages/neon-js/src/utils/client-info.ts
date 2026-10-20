import pkg from '../../package.json' with { type: 'json' };
import { getClientInfo as getInternalClientInfo } from '@neondatabase/internal';
import { BETTER_AUTH_VERSION } from '@neondatabase/auth';

export function buildNeonJsClientInfo(): string {
  const info = getInternalClientInfo(pkg.name, pkg.version, {
    betterAuthVersion: BETTER_AUTH_VERSION,
  });
  return JSON.stringify(info);
}

export {
  injectClientInfo,
  X_NEON_CLIENT_INFO_HEADER,
  type ClientInfo,
  getClientInfo,
} from '@neondatabase/postgrest-js';
