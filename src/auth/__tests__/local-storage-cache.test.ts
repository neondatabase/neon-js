import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LocalStorageCache } from '@/auth/adapters/better-auth/local-storage-cache';
import type { Session } from '@supabase/auth-js';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('LocalStorageCache', () => {
  let cache: LocalStorageCache;
  const mockSession: Session = {
    access_token: 'test-jwt-token',
    refresh_token: 'refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: {
      id: 'user-123',
      email: 'test@example.com',
      user_metadata: {},
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
  };

  beforeEach(() => {
    cache = new LocalStorageCache('test-auth', 60_000);
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe('set and get', () => {
    it('should store and retrieve session', () => {
      cache.set(mockSession);
      const retrieved = cache.get();
      expect(retrieved).toEqual(mockSession);
    });

    it('should return null for empty cache', () => {
      expect(cache.get()).toBeNull();
    });
  });

  describe('expiration', () => {
    it('should return null for expired session', async () => {
      cache.set(mockSession, 10); // 10ms TTL
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(cache.get()).toBeNull();
    });

    it('should not return expired session from storage', () => {
      cache.set(mockSession, 1);
      // Wait for expiration
      return new Promise(resolve => {
        setTimeout(() => {
          expect(cache.get()).toBeNull();
          resolve(undefined);
        }, 10);
      });
    });
  });

  describe('clear and invalidation', () => {
    it('should clear session and set invalidation flag', () => {
      cache.set(mockSession);
      expect(cache.get()).not.toBeNull();

      cache.clear();
      expect(cache.get()).toBeNull();
      expect(cache.isInvalidated()).toBe(true);
    });

    it('should not return session when invalidated', () => {
      cache.set(mockSession);
      cache.clear();

      // Even if we manually restore the session in storage
      const stored = {
        session: mockSession,
        expiresAt: Date.now() + 60000,
      };
      localStorageMock.setItem('test-auth:session', JSON.stringify(stored));

      // Should still return null due to invalidation flag
      expect(cache.get()).toBeNull();
    });

    it('should clear invalidation flag when setting new session', () => {
      cache.clear();
      expect(cache.isInvalidated()).toBe(true);

      cache.set(mockSession);
      expect(cache.isInvalidated()).toBe(false);
      expect(cache.get()).toEqual(mockSession);
    });
  });

  describe('has', () => {
    it('should return true when session exists', () => {
      cache.set(mockSession);
      expect(cache.has()).toBe(true);
    });

    it('should return false when no session', () => {
      expect(cache.has()).toBe(false);
    });

    it('should return false when invalidated', () => {
      cache.set(mockSession);
      cache.clear();
      expect(cache.has()).toBe(false);
    });
  });

  describe('getRemainingTTL', () => {
    it('should return remaining TTL in milliseconds', () => {
      cache.set(mockSession, 10_000);
      const ttl = cache.getRemainingTTL();
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(10_000);
    });

    it('should return 0 for expired session', async () => {
      cache.set(mockSession, 10);
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(cache.getRemainingTTL()).toBe(0);
    });

    it('should return 0 for empty cache', () => {
      expect(cache.getRemainingTTL()).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle malformed JSON gracefully', () => {
      localStorageMock.setItem('test-auth:session', 'invalid json {');

      expect(cache.get()).toBeNull();
    });
  });

});
