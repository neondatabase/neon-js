/**
 * Framework-agnostic HTTP proxy utilities for Neon Auth
 *
 * These utilities handle proxying requests to the upstream Neon Auth server
 * and processing responses, including session cookie minting.
 */

export {
  handleAuthRequest,
  getUpstreamURL,
  NEON_AUTH_HEADER_MIDDLEWARE_NAME,
} from './request';

export {
  handleAuthResponse,
} from './response';

export {
  handleAuthProxyRequest,
  type AuthProxyConfig,
} from './handler';
