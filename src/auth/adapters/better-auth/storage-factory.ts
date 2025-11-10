import type { SessionStorage } from './storage-interface';
import { LocalStorageCache } from './local-storage-cache';
import { SessionCache } from './session-cache';
import { isBrowser } from '@/auth/adapters/shared-helpers';
import { DEFAULT_STORAGE_KEY_PREFIX, SESSION_CACHE_TTL_MS } from './constants';

/**
 * Create appropriate session storage based on environment
 *
 * Browser: LocalStorageCache (automatic multi-tab sync)
 * Node.js: InMemoryCache (single-instance cache)
 *
 * @param keyPrefix - Storage key prefix (default: 'neon-auth')
 * @param ttl - Time to live in milliseconds (default: 60000)
 * @returns SessionStorage implementation
 */
export function createSessionStorage(
  keyPrefix = DEFAULT_STORAGE_KEY_PREFIX,
  ttl = SESSION_CACHE_TTL_MS
): SessionStorage {
  // Browser environment with localStorage support
  if (isBrowser() && typeof localStorage !== 'undefined') {
    return new LocalStorageCache(keyPrefix, ttl);
  }

  // Node.js or browser without localStorage
  return new SessionCache(ttl);
}
