import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemorySessionCache } from '../adapters/better-auth/in-memory-session-cache';
import type { Session } from '@supabase/auth-js';

const mockSession: Session = {
  access_token: 'mock-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'mock-refresh-token',
  user: {
    id: 'user-123',
    email: 'test@example.com',
    aud: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  },
};

describe('InMemorySessionCache', () => {
  let cache: InMemorySessionCache;

  beforeEach(() => {
    cache = new InMemorySessionCache(60_000); // 60 second TTL
  });

  describe('get/set', () => {
    it('should return null when cache is empty', () => {
      expect(cache.get()).toBeNull();
    });

    it('should return session after set', () => {
      cache.set(mockSession);
      expect(cache.get()).toEqual(mockSession);
    });

    it('should return null after TTL expires', () => {
      vi.useFakeTimers();

      cache.set(mockSession);
      expect(cache.get()).toEqual(mockSession);

      // Fast-forward 61 seconds
      vi.advanceTimersByTime(61_000);

      expect(cache.get()).toBeNull();

      vi.useRealTimers();
    });

    it('should not expire before TTL', () => {
      vi.useFakeTimers();

      cache.set(mockSession);

      // Fast-forward 59 seconds (still within TTL)
      vi.advanceTimersByTime(59_000);

      expect(cache.get()).toEqual(mockSession);

      vi.useRealTimers();
    });
  });

  describe('clear', () => {
    it('should clear cache immediately', () => {
      cache.set(mockSession);
      expect(cache.get()).toEqual(mockSession);

      cache.clear();
      expect(cache.get()).toBeNull();
    });

    it('should not throw when clearing empty cache', () => {
      expect(() => cache.clear()).not.toThrow();
    });
  });

  describe('has', () => {
    it('should return false when cache is empty', () => {
      expect(cache.has()).toBe(false);
    });

    it('should return true when cache has valid entry', () => {
      cache.set(mockSession);
      expect(cache.has()).toBe(true);
    });

    it('should return false after TTL expires', () => {
      vi.useFakeTimers();

      cache.set(mockSession);
      expect(cache.has()).toBe(true);

      vi.advanceTimersByTime(61_000);
      expect(cache.has()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('getRemainingTTL', () => {
    it('should return 0 when cache is empty', () => {
      expect(cache.getRemainingTTL()).toBe(0);
    });

    it('should return approximate remaining TTL', () => {
      vi.useFakeTimers();

      cache.set(mockSession);

      // Immediately after set, should have ~60 seconds
      expect(cache.getRemainingTTL()).toBeGreaterThan(59_000);
      expect(cache.getRemainingTTL()).toBeLessThanOrEqual(60_000);

      // After 30 seconds
      vi.advanceTimersByTime(30_000);
      expect(cache.getRemainingTTL()).toBeGreaterThan(29_000);
      expect(cache.getRemainingTTL()).toBeLessThanOrEqual(30_000);

      vi.useRealTimers();
    });

    it('should return 0 after expiration', () => {
      vi.useFakeTimers();

      cache.set(mockSession);
      vi.advanceTimersByTime(61_000);

      expect(cache.getRemainingTTL()).toBe(0);

      vi.useRealTimers();
    });
  });

  describe('custom TTL', () => {
    it('should respect custom TTL', () => {
      vi.useFakeTimers();

      const customCache = new InMemorySessionCache(5_000); // 5 seconds
      customCache.set(mockSession);

      expect(customCache.get()).toEqual(mockSession);

      vi.advanceTimersByTime(4_000);
      expect(customCache.get()).toEqual(mockSession);

      vi.advanceTimersByTime(2_000); // Total 6 seconds
      expect(customCache.get()).toBeNull();

      vi.useRealTimers();
    });
  });

  describe('validation', () => {
    it('should throw error when setting invalid session data', () => {
      const invalidSession = {
        access_token: 'token',
        // Missing required fields
      } as unknown as Session;

      expect(() => cache.set(invalidSession)).toThrow(/Invalid cache entry/);
    });

    it('should throw error when session is missing user', () => {
      const sessionWithoutUser = {
        access_token: 'token',
        refresh_token: 'refresh',
        token_type: 'bearer',
        expires_in: 3600,
        // Missing user field
      } as unknown as Session;

      expect(() => cache.set(sessionWithoutUser)).toThrow(/Invalid cache entry/);
    });

    it('should accept valid session with all required fields', () => {
      const validSession: Session = {
        ...mockSession,
      };

      expect(() => cache.set(validSession)).not.toThrow();
      expect(cache.get()).toEqual(validSession);
    });
  });
});
