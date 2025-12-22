import pkg from '../../package.json' with { type: 'json' };
import { getClientInfo } from '@neondatabase/postgrest-js';

export function buildNeonJsClientInfo(): string {
  const info = getClientInfo(pkg.name, pkg.version);
  return JSON.stringify(info);
}

export {
  injectClientInfo,
  X_NEON_CLIENT_INFO_HEADER,
  type ClientInfo,
  getClientInfo,
} from '@neondatabase/postgrest-js';
