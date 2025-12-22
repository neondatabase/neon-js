export {
  NeonPostgrestClient,
  type NeonPostgrestClientConstructorOptions,
  type DefaultSchemaName,
} from './postgrest-client.js';

export { fetchWithToken, AuthRequiredError } from './fetch-with-token.js';

// Re-export client-info utilities for packages that need to build custom client info
export {
  injectClientInfo,
  getClientInfo,
  X_NEON_CLIENT_INFO_HEADER,
  type ClientInfo,
} from '../utils/client-info.js';
