import type { Session } from '@supabase/auth-js';
import type { SessionStorage } from './storage-interface';
import { SESSION_CACHE_TTL_MS, DEFAULT_STORAGE_KEY_PREFIX } from './constants';
import { localStorageCacheEntrySchema, type LocalStorageCacheEntry } from './storage-schemas';

/**
 * LocalStorage-based session cache for browser environments.
 * Provides automatic multi-tab sync with TTL-based expiration.
 */
export class LocalStorageCache implements SessionStorage {
  private storageKey: string;
  private invalidationKey: string;
  private defaultTTL: number;

  constructor(
    keyPrefix = DEFAULT_STORAGE_KEY_PREFIX,
    ttl = SESSION_CACHE_TTL_MS
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

      // Parse and validate JSON data
      const parsed = JSON.parse(stored);
      const validationResult = localStorageCacheEntrySchema.safeParse(parsed);

      if (!validationResult.success) {
        console.warn(
          '[LocalStorageCache] Invalid stored session format:',
          validationResult.error
        );
        // Clear invalid data
        this.clear();
        return null;
      }

      const validated = validationResult.data;

      // Check expiration
      if (Date.now() >= validated.expiresAt) {
        // Expired - clean up
        console.debug('[LocalStorageCache] Expired - clearing');
        this.clear();
        return null;
      }

      console.debug('[LocalStorageCache] Hit - returning cached session');
      // Cast validated data back to Session type (validated structure matches)
      return validated.session as Session;
    } catch (error) {
      console.warn('[LocalStorageCache] Error reading session:', error);
      return null;
    }
  }

  set(session: Session, ttl = this.defaultTTL): void {
    try {
      const stored: LocalStorageCacheEntry = {
        session,
        expiresAt: Date.now() + ttl,
      };

      // Validate before storing
      const validationResult = localStorageCacheEntrySchema.safeParse(stored);
      if (!validationResult.success) {
        console.error(
          '[LocalStorageCache] Validation failed:',
          validationResult.error
        );
        throw new Error(
          `Invalid session data: ${validationResult.error.message}`
        );
      }

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

      // Parse and validate JSON data
      const parsed = JSON.parse(stored);
      const validationResult = localStorageCacheEntrySchema.safeParse(parsed);

      if (!validationResult.success) {
        console.warn(
          '[LocalStorageCache] Invalid stored session in getRemainingTTL:',
          validationResult.error
        );
        return 0;
      }

      const validated = validationResult.data;
      const remaining = validated.expiresAt - Date.now();
      return Math.max(0, remaining);
    } catch {
      return 0;
    }
  }

  has(): boolean {
    return this.get() !== null;
  }
}
