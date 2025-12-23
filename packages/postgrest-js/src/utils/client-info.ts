import pkg from '../../package.json' with { type: 'json' };
import { createClientInfoInjector } from '@neondatabase/internal';

export type { ClientInfo } from '@neondatabase/internal';
export { getClientInfo, X_NEON_CLIENT_INFO_HEADER } from '@neondatabase/internal';

export const injectClientInfo = createClientInfoInjector(pkg.name, pkg.version);
