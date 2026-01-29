/**
 * Framework-agnostic middleware utilities for Neon Auth
 *
 * These utilities provide core middleware functionality that can be
 * used across different server frameworks (Next.js, Remix, SvelteKit, etc.)
 */

export {
  needsSessionVerification,
  exchangeOAuthToken,
  type OAuthExchangeResult,
} from './oauth';

export {
  shouldProtectRoute,
  checkSessionRequired,
  type SessionCheckResult,
} from './route-protection';

export {
  processAuthMiddleware,
  type MiddlewareResult,
  type AuthMiddlewareConfig,
} from './processor';
