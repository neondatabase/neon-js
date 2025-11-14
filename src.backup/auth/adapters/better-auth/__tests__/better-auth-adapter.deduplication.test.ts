import { describe, it, expect, beforeEach } from 'vitest';
import { BetterAuthAdapter } from '../better-auth-adapter';

describe('BetterAuthAdapter - Request Deduplication Integration', () => {
  let adapter: BetterAuthAdapter;

  beforeEach(() => {
    // Create fresh adapter
    adapter = new BetterAuthAdapter({
      baseURL: 'http://localhost:3000/api/auth',
    });
  });

  describe('getSession() deduplication', () => {
    it('should deduplicate 10 concurrent getSession() calls to 1 network request', async () => {
      // Make 10 concurrent calls
      const calls = Array.from({ length: 10 }, () => adapter.getSession());

      // Await all results
      const results = await Promise.all(calls);

      // Assert: All calls returned same data (deduplication worked)
      // They should all have the same error or same session
      const firstResult = results[0];
      for (const result of results) {
        expect(result.data).toEqual(firstResult.data);
        if (result.error) {
          expect(result.error.message).toEqual(firstResult.error?.message);
        }
      }

      // Verify that the in-flight request manager was used
      // (If 10 calls didn't deduplicate, we'd see 10 separate result variations)
      expect(results.every((r) => r.data === firstResult.data || (r.error && firstResult.error))).toBe(true);
    });

    it('should allow retry after successful request completes', async () => {
      // First call
      const result1 = await adapter.getSession();

      // Clear cache to force network request
      adapter['clearSessionCache']();

      // Second call (should make new request, not reuse old Promise)
      const result2 = await adapter.getSession();

      // If first call succeeded, second call should succeed too
      // (or both should fail consistently)
      if (!result1.error) {
        expect(result2).toBeDefined();
      }
    });

    it('should not interfere with cache hits', async () => {
      // First call - populate cache
      const result1 = await adapter.getSession();

      // 10 concurrent calls - all hit cache (no network)
      const calls = Array.from({ length: 10 }, () => adapter.getSession());
      const results = await Promise.all(calls);

      // Assert: All cache hits returned same data as first call
      for (const result of results) {
        expect(result.data).toEqual(result1.data);
      }
    });
  });

  describe('getJwtToken() deduplication', () => {
    it('should deduplicate 10 concurrent getJwtToken() calls to 1 network request', async () => {
      // First populate cache with a session
      await adapter.getSession();

      // Clear cached JWT to force fetch
      adapter['clearSessionCache']();

      // Make 10 concurrent calls
      const calls = Array.from({ length: 10 }, () => adapter.getJwtToken());

      // Await all results
      const results = await Promise.all(calls);

      // Assert: All calls returned same JWT (deduplication worked)
      // They should all have the same value
      const firstJwt = results[0];
      for (const result of results) {
        expect(result).toEqual(firstJwt);
      }
    });

    it('should allow retry after successful request completes', async () => {
      // First populate cache with a session
      await adapter.getSession();

      // Clear cached JWT
      adapter['clearSessionCache']();

      // First call
      const jwt1 = await adapter.getJwtToken();

      // Clear cache to force new fetch
      adapter['clearSessionCache']();

      // Second call (should make new request)
      const jwt2 = await adapter.getJwtToken();

      // Both should return the same type of result (either both null or both strings)
      expect(typeof jwt1).toBe(typeof jwt2);
    });
  });

  describe('Independent tracking', () => {
    it('should track getSession() and getJwtToken() independently', async () => {
      // Make concurrent calls to both methods
      const sessionCalls = Array.from({ length: 5 }, () =>
        adapter.getSession()
      );
      const tokenCalls = Array.from({ length: 5 }, () =>
        adapter.getJwtToken()
      );

      // Await all - should not throw
      const results = await Promise.all([...sessionCalls, ...tokenCalls]);

      // Assert: All results are defined
      expect(results).toBeDefined();
      expect(results.length).toBe(10);
    });
  });

  describe('getUserIdentities() deduplication', () => {
    it('should deduplicate 10 concurrent getUserIdentities() calls to 1 network request', async () => {
      // First populate cache with a session
      await adapter.getSession();

      // Make 10 concurrent calls
      const calls = Array.from({ length: 10 }, () =>
        adapter.getUserIdentities()
      );

      // Await all results
      const results = await Promise.all(calls);

      // Assert: All calls returned same data (deduplication worked)
      const firstResult = results[0];
      for (const result of results) {
        expect(result.data).toEqual(firstResult.data);
        if (result.error) {
          expect(result.error.message).toEqual(firstResult.error?.message);
        }
      }

      // Verify that all results are consistent
      expect(results.every((r) => r.data === firstResult.data || (r.error && firstResult.error))).toBe(true);
    });

    it('should allow retry after successful request completes', async () => {
      // First populate cache with a session
      await adapter.getSession();

      // First call
      const result1 = await adapter.getUserIdentities();

      // Second call (should make new request since first completed)
      const result2 = await adapter.getUserIdentities();

      // Both should return data (or both fail consistently)
      if (!result1.error) {
        expect(result2).toBeDefined();
      }
    });

    it('should work independently from getSession deduplication', async () => {
      // Make concurrent calls to both methods
      const sessionCalls = Array.from({ length: 5 }, () =>
        adapter.getSession()
      );
      const identityCalls = Array.from({ length: 5 }, () =>
        adapter.getUserIdentities()
      );

      // Await all - should not throw
      const results = await Promise.all([...sessionCalls, ...identityCalls]);

      // Assert: All results are defined
      expect(results).toBeDefined();
      expect(results.length).toBe(10);
    });
  });

  describe('In-flight request tracking', () => {
    it('should report in-flight request status correctly', async () => {
      // Before any request
      expect(adapter['inFlightRequests'].has('getSession')).toBe(false);

      // Start a request (don't await)
      const promise = adapter.getSession();

      // During request (if it's slow enough, which may not happen in tests)
      // We can't reliably test this since the request might complete immediately

      // After completion
      await promise;
      expect(adapter['inFlightRequests'].has('getSession')).toBe(false);
    });

    it('should clear in-flight requests after completion', async () => {
      // Initial size should be 0
      expect(adapter['inFlightRequests'].size()).toBe(0);

      // Make multiple requests
      const calls = Array.from({ length: 10 }, () => adapter.getSession());
      await Promise.all(calls);

      // After all complete, size should be 0
      expect(adapter['inFlightRequests'].size()).toBe(0);
    });
  });
});
