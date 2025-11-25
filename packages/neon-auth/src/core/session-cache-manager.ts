import type { Session } from '@supabase/auth-js';
import { SESSION_CACHE_TTL_MS, CLOCK_SKEW_BUFFER_MS } from './constants';
import { getJwtExpiration } from '../utils/jwt';

type SessionCache = {
  session: Session;
  expiresAt: number;
  invalidated?: boolean;
} | null;

/**
 * Manages in-memory session cache with TTL expiration.
 *
 * Features:
 * - Automatic expiration based on JWT token expiration
 * - Invalidation flag for sign-out scenarios
 * - TTL calculation with clock skew buffer
 *
 * Example:
 *pt
 * const cacheManager = new SessionCacheManager();
 * cacheManager.setCachedSession(session);
 * const cached = cacheManager.getCachedSession();
 *  */
export class SessionCacheManager {
  private cache: SessionCache = null;
  private lastSession: Session | null = null;

  /**
   * Get cached session if valid and not expired.
   * Returns null if cache is invalid, expired, or doesn't exist.
   */
  getCachedSession(): Session | null {
    if (!this.cache || this.cache.invalidated) {
      console.log(
        '[SessionCacheManager] Cache miss: no cached session or invalidated'
      );
      return null;
    }

    if (Date.now() > this.cache.expiresAt) {
      console.log('[SessionCacheManager] Cache miss: session expired');
      this.clearSessionCache();
      return null;
    }

    console.log('[SessionCacheManager] Cache hit: returning cached session');
    return this.cache.session;
  }

  /**
   * Set cached session with optional TTL.
   * If TTL not provided, calculates from JWT expiration.
   * Skips caching if cache was invalidated (sign-out scenario).
   */
  setCachedSession(session: Session, ttl?: number): void {
    // Check if cache was invalidated (signOut called during in-flight request)
    if (this.cache?.invalidated) {
      console.log(
        '[SessionCacheManager] Cache invalidated, skipping setCachedSession'
      );
      return;
    }

    // Store current cache session as lastSession before updating
    this.lastSession = this.cache?.session ?? null;

    const calculatedTtl = ttl ?? this.calculateCacheTTL(session.access_token);
    console.log(
      `[SessionCacheManager] Setting cached session (TTL: ${calculatedTtl}ms)`
    );

    this.cache = {
      session,
      expiresAt: Date.now() + calculatedTtl,
      invalidated: false,
    };
  }

  /**
   * Invalidate cache (marks as invalid but doesn't clear).
   * Useful for sign-out scenarios where in-flight requests should not cache.
   */
  invalidateSessionCache(): void {
    if (this.cache) {
      this.cache.invalidated = true;
      console.log('[SessionCacheManager] Cache invalidated');
    }
  }

  /**
   * Clear cache completely.
   */
  clearSessionCache(): void {
    console.log('[SessionCacheManager] Clearing session cache');
    this.cache = null;
    this.lastSession = null;
  }

  /**
   * Check if token was refreshed by comparing access_token with previous session.
   * Returns true if tokens differ (token was refreshed), false otherwise.
   */
  wasTokenRefreshed(session: Session): boolean {
    if (!this.lastSession?.access_token || !session?.access_token) {
      return false;
    }
    return this.lastSession.access_token !== session.access_token;
  }

  /**
   * Calculate cache TTL from JWT expiration.
   * Falls back to default TTL if JWT is invalid or missing.
   */
  private calculateCacheTTL(jwt: string | undefined): number {
    if (!jwt) {
      return SESSION_CACHE_TTL_MS;
    }

    const exp = getJwtExpiration(jwt);
    if (!exp) {
      return SESSION_CACHE_TTL_MS;
    }

    const now = Date.now();
    const expiresAtMs = exp * 1000;
    const ttl = expiresAtMs - now - CLOCK_SKEW_BUFFER_MS;

    return Math.max(ttl, 1000);
  }
}
