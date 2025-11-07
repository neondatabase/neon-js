import type { Session } from '@supabase/auth-js';

/**
 * Cache entry with TTL tracking
 */
interface CacheEntry {
  session: Session;
  expiresAt: number; // Unix timestamp (ms)
}

/**
 * Synchronous in-memory session cache with TTL-based expiration
 *
 * Design inspired by Clerk's 60-second session token caching strategy.
 * Provides immediate synchronous reads when cache is valid, falling back
 * to async fetch when expired.
 *
 * Key characteristics:
 * - Synchronous get/set/clear operations
 * - 60-second TTL (configurable)
 * - Lazy expiration (checked on read, not proactively cleaned)
 * - Per-adapter instance scope
 * - No external dependencies
 * - Invalidation support to prevent returning stale data during sign-out
 */
export class SessionCache {
  private cache: CacheEntry | null = null;
  private readonly ttlMs: number;
  private invalidated: boolean = false; // Flag to prevent returning stale data

  /**
   * @param ttlMs - Time to live in milliseconds (default: 60000 = 60 seconds)
   */
  constructor(ttlMs: number = 60_000) {
    this.ttlMs = ttlMs;
  }

  /**
   * Get cached session (synchronous)
   * Returns null if cache is empty, expired, or invalidated
   */
  get(): Session | null {
    // Check invalidation flag first - prevents returning stale data during sign-out
    if (this.invalidated) {
      console.debug('[Session Cache] Invalidated - returning null');
      return null;
    }

    if (!this.cache) {
      return null;
    }

    // Lazy expiration check
    if (Date.now() > this.cache.expiresAt) {
      console.debug('[Session Cache] Expired - clearing');
      this.cache = null;
      return null;
    }

    console.debug('[Session Cache] Hit - returning cached session');
    return this.cache.session;
  }

  /**
   * Set session in cache (synchronous)
   * Clears invalidation flag to allow new sessions
   */
  set(session: Session): void {
    this.cache = {
      session,
      expiresAt: Date.now() + this.ttlMs,
    };
    this.invalidated = false; // Clear invalidation flag for new session
    console.debug(
      '[Session Cache] Set - expires at',
      new Date(this.cache.expiresAt).toISOString()
    );
  }

  /**
   * Clear cache immediately (synchronous)
   * Sets invalidation flag to prevent in-flight reads from returning stale data
   * Used on sign-out and auth state changes
   */
  clear(): void {
    console.debug('[Session Cache] Clear');
    this.cache = null;
    this.invalidated = true; // Set flag to invalidate any in-flight reads
  }

  /**
   * Check if cache has a valid entry (synchronous)
   */
  has(): boolean {
    return this.get() !== null;
  }

  /**
   * Check if cache has been invalidated (synchronous)
   * Used by getSession() to detect mid-execution sign-outs
   */
  isInvalidated(): boolean {
    return this.invalidated;
  }

  /**
   * Get remaining TTL in milliseconds
   * Returns 0 if cache is empty or expired
   */
  getRemainingTTL(): number {
    if (!this.cache) {
      return 0;
    }
    const remaining = this.cache.expiresAt - Date.now();
    return Math.max(0, remaining);
  }
}
