import type { Session } from '@supabase/auth-js';
import type { SessionStorage } from './storage-interface';

interface StoredSession {
  session: Session;
  expiresAt: number;
}

/**
 * LocalStorage-based session cache for browser environments
 *
 * Features:
 * - Automatic multi-tab synchronization (all tabs read same localStorage key)
 * - TTL-based expiration (default 60 seconds)
 * - Invalidation flag prevents race conditions during sign-out
 * - Matches Supabase's storage pattern exactly
 *
 * Security Note:
 * - Stores JWT in localStorage (XSS vulnerable but industry standard)
 * - Same trade-off as Supabase, Firebase, Auth0
 * - Better Auth session cookie remains httpOnly (secure)
 */
export class LocalStorageCache implements SessionStorage {
  private storageKey: string;
  private invalidationKey: string;
  private defaultTTL: number;

  constructor(
    keyPrefix = 'neon-auth',
    ttl = 60_000 // 60 seconds (matches Clerk)
  ) {
    this.storageKey = `${keyPrefix}:session`;
    this.invalidationKey = `${keyPrefix}:invalidated`;
    this.defaultTTL = ttl;
  }

  get(): Session | null {
    try {
      // Check invalidation flag first (race condition prevention)
      if (this.isInvalidated()) {
        console.debug('[LocalStorageCache] Invalidated - returning null');
        return null;
      }

      const stored = localStorage.getItem(this.storageKey);
      if (!stored) {
        return null;
      }

      const parsed: StoredSession = JSON.parse(stored);

      // Check expiration
      if (Date.now() >= parsed.expiresAt) {
        // Expired - clean up
        console.debug('[LocalStorageCache] Expired - clearing');
        this.clear();
        return null;
      }

      console.debug('[LocalStorageCache] Hit - returning cached session');
      return parsed.session;
    } catch (error) {
      console.warn('[LocalStorageCache] Error reading session:', error);
      return null;
    }
  }

  set(session: Session, ttl = this.defaultTTL): void {
    try {
      const stored: StoredSession = {
        session,
        expiresAt: Date.now() + ttl,
      };

      localStorage.setItem(this.storageKey, JSON.stringify(stored));

      // Clear invalidation flag (new session set)
      localStorage.removeItem(this.invalidationKey);

      console.debug(
        '[LocalStorageCache] Set - expires at',
        new Date(stored.expiresAt).toISOString()
      );
    } catch (error) {
      console.warn('[LocalStorageCache] Error storing session:', error);
    }
  }

  clear(): void {
    try {
      // Set invalidation flag BEFORE clearing (race condition prevention)
      localStorage.setItem(this.invalidationKey, 'true');

      // Clear session data
      localStorage.removeItem(this.storageKey);

      console.debug('[LocalStorageCache] Clear');
    } catch (error) {
      console.warn('[LocalStorageCache] Error clearing session:', error);
    }
  }

  isInvalidated(): boolean {
    try {
      return localStorage.getItem(this.invalidationKey) === 'true';
    } catch {
      return false;
    }
  }

  getRemainingTTL(): number {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) {
        return 0;
      }

      const parsed: StoredSession = JSON.parse(stored);
      const remaining = parsed.expiresAt - Date.now();
      return Math.max(0, remaining);
    } catch {
      return 0;
    }
  }

  has(): boolean {
    return this.get() !== null;
  }
}
