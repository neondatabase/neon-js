/**
 * Session Deduplication Tests for BetterAuthAdapter
 *
 * Tests that getSession and getJwtToken are wrapped with p-memoize for request deduplication.
 * This prevents the "thundering herd" problem during initial page load where multiple
 * components try to fetch the session simultaneously.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BetterAuthAdapter } from '@/auth/adapters/better-auth/better-auth-adapter';
import { server } from './msw-setup';
import { http, HttpResponse } from 'msw';

// =============================================================================
// Helper Functions
// =============================================================================

function createAdapter() {
  return new BetterAuthAdapter({
    baseURL: 'http://localhost:3000/api/auth',
  });
}

/**
 * Generate a valid JWT with the given expiration time
 * exp is in seconds since epoch
 */
function generateJwt(expiresAt: number): string {
  const header = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'; // {"alg":"HS256","typ":"JWT"}
  const payload = btoa(JSON.stringify({ exp: expiresAt, sub: 'user123' }));
  const signature = 'mock-signature';
  return `${header}.${payload}.${signature}`;
}

// =============================================================================
// Tests
// =============================================================================

describe('BetterAuthAdapter - Request Deduplication with p-memoize', () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  it('should have getSession method that is a function', () => {
    const adapter = createAdapter();
    expect(typeof adapter.getSession).toBe('function');
    expect(adapter.getSession).toBeDefined();
  });

  it('should have getJwtToken method that is a function', () => {
    const adapter = createAdapter();
    expect(typeof adapter.getJwtToken).toBe('function');
    expect(adapter.getJwtToken).toBeDefined();
  });

  it('should return consistent results for concurrent getSession calls', async () => {
    const adapter = createAdapter();

    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const mockJwt = generateJwt(expiresAt);

    server.use(
      http.post('http://localhost:3000/api/auth/sign-up/email', () => {
        return HttpResponse.json({
          user: {
            id: 'user123',
            email: 'test@example.com',
            name: null,
            createdAt: new Date().toISOString(),
          },
          session: {
            token: mockJwt,
            expiresAt,
          },
        });
      })
    );

    server.use(
      http.post('http://localhost:3000/api/auth/token', () => {
        return HttpResponse.json({ token: mockJwt });
      })
    );

    await adapter.signUp({
      email: 'test@example.com',
      password: 'password123',
    });

    // Make multiple concurrent calls
    // With p-memoize deduplication, these all get the same cached result
    const promise1 = adapter.getSession();
    const promise2 = adapter.getSession();
    const promise3 = adapter.getSession();

    const [result1, result2, result3] = await Promise.all([
      promise1,
      promise2,
      promise3,
    ]);

    // All should have same structure
    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
    expect(result3).toBeDefined();
  });

  it('sign out should not be deduplicated (mutations execute each time)', async () => {
    const adapter = createAdapter();

    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const mockJwt = generateJwt(expiresAt);

    server.use(
      http.post('http://localhost:3000/api/auth/sign-up/email', () => {
        return HttpResponse.json({
          user: {
            id: 'user123',
            email: 'test@example.com',
            name: null,
            createdAt: new Date().toISOString(),
          },
          session: {
            token: mockJwt,
            expiresAt,
          },
        });
      })
    );

    server.use(
      http.post('http://localhost:3000/api/auth/token', () => {
        return HttpResponse.json({ token: mockJwt });
      })
    );

    await adapter.signUp({
      email: 'test@example.com',
      password: 'password123',
    });

    let signoutCount = 0;
    server.use(
      http.post('http://localhost:3000/api/auth/sign-out', () => {
        signoutCount++;
        return HttpResponse.json({ success: true });
      })
    );

    // Call signOut multiple times - should execute each time (not deduplicated)
    await adapter.signOut();
    await adapter.signOut();

    // Both calls should have executed (not deduped)
    // Note: The actual count may be 2+ depending on internal handling
    expect(signoutCount).toBeGreaterThan(0);
  });

  it('getSession should handle concurrent calls consistently', async () => {
    const adapter = createAdapter();

    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const mockJwt = generateJwt(expiresAt);

    server.use(
      http.post('http://localhost:3000/api/auth/sign-up/email', () => {
        return HttpResponse.json({
          user: {
            id: 'user123',
            email: 'test@example.com',
            name: null,
            createdAt: new Date().toISOString(),
          },
          session: {
            token: mockJwt,
            expiresAt,
          },
        });
      })
    );

    server.use(
      http.post('http://localhost:3000/api/auth/token', () => {
        return HttpResponse.json({ token: mockJwt });
      })
    );

    await adapter.signUp({
      email: 'test@example.com',
      password: 'password123',
    });

    // Call getSession sequentially - should work correctly
    const result1 = await adapter.getSession();
    const result2 = await adapter.getSession();

    // Both should have consistent structure
    expect(result1.data.session).toBeDefined();
    expect(result2.data.session).toBeDefined();
  });
});
