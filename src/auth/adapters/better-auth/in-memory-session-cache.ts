import type { Session } from '@supabase/auth-js';
import type { SessionStorage } from './storage-interface';
import { SESSION_CACHE_TTL_MS } from './constants';
import { inMemoryCacheEntrySchema, type InMemoryCacheEntry } from './storage-schemas';
import { z } from 'zod';

/**
 * Synchronous in-memory session cache with TTL-based expiration.
 * Provides immediate reads when valid, with invalidation support to prevent stale data.
 */
export class InMemorySessionCache implements SessionStorage {
  private cache: InMemoryCacheEntry | null = null;
  private readonly ttlMs: number;
  /**
   * Invalidation flag prevents race conditions during sign-out.
   * Set before cache clear, checked before returning cached data.
   */
  private invalidated: boolean = false;

  /**
   * @param ttlMs - Time to live in milliseconds (default: 60000 = 60 seconds)
   */
  constructor(ttlMs: number = SESSION_CACHE_TTL_MS) {
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
   * Validates cache entry using Zod schema
   */
  set(session: Session): void {
    const cacheEntry = {
      session,
      expiresAt: Date.now() + this.ttlMs,
    };

    // Validate cache entry structure
    try {
      inMemoryCacheEntrySchema.parse(cacheEntry);
      this.cache = cacheEntry;
      this.invalidated = false; // Clear invalidation flag for new session
      console.debug(
        '[Session Cache] Set - expires at',
        new Date(this.cache.expiresAt).toISOString()
      );
    } catch (error) {
      console.error('[Session Cache] Validation failed:', error);
      throw new Error(
        `Invalid cache entry: ${error instanceof z.ZodError ? error.message : 'Unknown validation error'}`
      );
    }
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

