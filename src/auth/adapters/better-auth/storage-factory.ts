import type { SessionStorage } from './storage-interface';
import { LocalStorageCache } from './local-storage-cache';
import { SessionCache } from './session-cache';
import { isBrowser } from '@/auth/adapters/shared-helpers';

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
  keyPrefix = 'neon-auth',
  ttl = 60_000
): SessionStorage {
  // Browser environment with localStorage support
  if (isBrowser() && typeof localStorage !== 'undefined') {
    console.log('[SessionStorage] Using LocalStorageCache (browser)');
    return new LocalStorageCache(keyPrefix, ttl);
  }

  // Node.js or browser without localStorage
  console.log('[SessionStorage] Using InMemoryCache (Node.js or no localStorage)');
  return new SessionCache(ttl);
}
