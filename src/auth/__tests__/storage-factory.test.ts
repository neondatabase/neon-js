import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createSessionStorage } from '@/auth/adapters/better-auth/storage-factory';
import { LocalStorageCache } from '@/auth/adapters/better-auth/local-storage-cache';
import { SessionCache } from '@/auth/adapters/better-auth/session-cache';

describe('createSessionStorage', () => {
  // Note: These tests run in Node.js environment, which means isBrowser() will return false
  // The factory will always use SessionCache in the test environment
  // We test the logic through the actual implementations

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create InMemoryCache (SessionCache) in Node.js test environment', () => {
    // In Node.js environment (where tests run), createSessionStorage returns SessionCache
    const storage = createSessionStorage();
    expect(storage).toBeInstanceOf(SessionCache);
  });

  it('should create storage with default parameters', () => {
    const storage = createSessionStorage();
    expect(storage).toBeDefined();
    expect(storage.get()).toBeNull();
  });

  it('should create storage with custom parameters', () => {
    const storage = createSessionStorage('custom-prefix', 120_000);
    expect(storage).toBeDefined();
    expect(storage.get()).toBeNull();
  });

});
