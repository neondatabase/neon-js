/**
 * Session caching configuration constants
 *
 * Uses industry-standard 60s cache TTL (common across auth providers).
 *
 * Note: Token refresh detection is now automatic via Better Auth's
 * fetchOptions.onSuccess callback. No polling is needed.
 */

/** Session cache TTL in milliseconds (60 seconds) */
export const SESSION_CACHE_TTL_MS = 60_000;

/** Clock skew buffer for token expiration checks in milliseconds (10 seconds) */
export const CLOCK_SKEW_BUFFER_MS = 10_000;

/** Default session expiry duration in milliseconds (1 hour) */
export const DEFAULT_SESSION_EXPIRY_MS = 3_600_000;

/** BroadcastChannel name for cross-tab auth state sync */
export const BROADCAST_CHANNEL_NAME = 'better-auth-state-changes';
