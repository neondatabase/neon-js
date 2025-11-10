/**
 * Session caching and token refresh configuration constants
 *
 * Industry Standards:
 * - Supabase: 30s polling, 60s cache
 * - Clerk: 50s polling, 60s cache
 */

/** Session cache TTL in milliseconds (60 seconds) */
export const SESSION_CACHE_TTL_MS = 60_000;

/** Token refresh check interval in milliseconds (30 seconds) */
export const TOKEN_REFRESH_CHECK_INTERVAL_MS = 30_000;

/** Clock skew buffer for token expiration checks in seconds (10 seconds) */
export const CLOCK_SKEW_BUFFER_SECONDS = 10;

/** Token refresh detection threshold in seconds (90 seconds before expiry) */
export const TOKEN_REFRESH_THRESHOLD_SECONDS = 90;

/** BroadcastChannel name for cross-tab auth state sync */
export const BROADCAST_CHANNEL_NAME = 'better-auth-state-changes';

/** Default session storage key prefix */
export const DEFAULT_STORAGE_KEY_PREFIX = 'neon-auth';
