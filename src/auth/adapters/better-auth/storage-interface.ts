import type { Session } from '@supabase/auth-js';

/**
 * Storage interface for session caching
 *
 * Implementations:
 * - LocalStorageCache: Browser environment, automatic multi-tab sync
 * - InMemoryCache: Node.js environment, single-instance cache
 */
export interface SessionStorage {
  /**
   * Get session from storage
   * Returns null if not found, expired, or invalidated
   */
  get(): Session | null;

  /**
   * Store session with TTL
   * @param session - Session to store
   * @param ttl - Time to live in milliseconds (default: 60000)
   */
  set(session: Session, ttl?: number): void;

  /**
   * Clear session from storage
   * Sets invalidation flag to prevent race conditions
   */
  clear(): void;

  /**
   * Check if storage has been invalidated
   * Used to prevent returning stale data during concurrent operations
   */
  isInvalidated(): boolean;

  /**
   * Get remaining TTL in milliseconds
   * Returns 0 if cache is empty or expired
   */
  getRemainingTTL(): number;

  /**
   * Check if storage has a valid entry (synchronous)
   */
  has(): boolean;
}
