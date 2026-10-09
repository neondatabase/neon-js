import pkg from '../../package.json' with { type: 'json' };
import { createClientInfoInjector } from '@neondatabase/internal';
import { BETTER_AUTH_VERSION } from './better-auth-version';

export type { ClientInfo } from '@neondatabase/internal';
export {
  getClientInfo,
  X_NEON_CLIENT_INFO_HEADER,
} from '@neondatabase/internal';

export const injectClientInfo = createClientInfoInjector(
  pkg.name,
  pkg.version,
  { betterAuthVersion: BETTER_AUTH_VERSION }
);
