import type { BetterAuthSession, BetterAuthUser } from './better-auth-types';
import { SESSION_CACHE_TTL_MS, CLOCK_SKEW_BUFFER_MS } from './constants';
import { getJwtExpiration } from '../utils/jwt';

/**
 * Cached session data in Better Auth native format.
 * The adapter is responsible for mapping to/from its specific format (e.g., Supabase).
 */
export type CachedSessionData = {
  session: BetterAuthSession;
  user: BetterAuthUser;
};

type SessionCache = {
  data: CachedSessionData;
  expiresAt: number;
  invalidated?: boolean;
} | null;

/**
 * Manages in-memory session cache with TTL expiration.
 *
 * Features:
 * - Stores sessions in Better Auth native format
 * - Automatic expiration based on JWT token expiration
 * - Invalidation flag for sign-out scenarios
 * - TTL calculation with clock skew buffer
 *
 * Example:
 * ```typescript
 * const cacheManager = new SessionCacheManager();
 * cacheManager.setCachedSession({ session, user });
 * const cached = cacheManager.getCachedSession();
 * ```
 */
export class SessionCacheManager {
  private cache: SessionCache = null;
  private lastSessionData: CachedSessionData | null = null;

  /**
   * Get cached session if valid and not expired.
   * Returns null if cache is invalid, expired, or doesn't exist.
   */
  getCachedSession(): CachedSessionData | null {
    if (!this.cache || this.cache.invalidated) {
      return null;
    }

    if (Date.now() > this.cache.expiresAt) {
      this.clearSessionCache();
      return null;
    }

    return this.cache.data;
  }

  /**
   * Set cached session with optional TTL.
   * If TTL not provided, calculates from JWT expiration.
   * Skips caching if cache was invalidated (sign-out scenario).
   */
  setCachedSession(data: CachedSessionData, ttl?: number): void {
    // Check if cache was invalidated (signOut called during in-flight request)
    if (this.cache?.invalidated) {
      return;
    }

    // Store current cache data as lastSessionData before updating
    this.lastSessionData = this.cache?.data ?? null;

    const calculatedTtl = ttl ?? this.calculateCacheTTL(data.session.token);

    this.cache = {
      data,
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
    }
  }

  /**
   * Clear cache completely.
   */
  clearSessionCache(): void {
    this.cache = null;
    this.lastSessionData = null;
  }

  /**
   * Check if token was refreshed by comparing tokens with previous session.
   * Returns true if tokens differ (token was refreshed), false otherwise.
   */
  wasTokenRefreshed(data: CachedSessionData): boolean {
    if (!this.lastSessionData?.session?.token || !data?.session?.token) {
      return false;
    }
    return this.lastSessionData.session.token !== data.session.token;
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
