/**
 * JWT Caching Tests for BetterAuthAdapter
 *
 * Tests JWT token caching behavior, cache invalidation, and request deduplication.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BetterAuthAdapter } from '../adapters/better-auth/better-auth-adapter';
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
// JWT Caching Tests
// =============================================================================

describe('BetterAuthAdapter - JWT Caching', () => {
  beforeEach(() => {
    // Reset handlers before each test
    server.resetHandlers();
  });

  describe('getJwtToken', () => {
    it('should return null when no session exists', async () => {
      const adapter = createAdapter();

      const jwt = await adapter.getJwtToken();
      expect(jwt).toBeNull();
    });

    it('should cache JWT token on first fetch', async () => {
      const adapter = createAdapter();

      // Setup session by mocking the atom
      const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const mockJwt = generateJwt(expiresAt);

      // Mock sign in to create session
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

      // Sign up to create session
      await adapter.signUp({
        email: 'test@example.com',
        password: 'password123',
      });

      // Mock token endpoint
      let tokenFetchCount = 0;
      server.use(
        http.post('http://localhost:3000/api/auth/token', () => {
          tokenFetchCount++;
          return HttpResponse.json({ token: mockJwt });
        })
      );

      // First call should fetch JWT
      const jwt1 = await adapter.getJwtToken();
      expect(jwt1).toBeTruthy();
      expect(tokenFetchCount).toBe(1);

      // Second call should use cache (no additional network request)
      const jwt2 = await adapter.getJwtToken();
      expect(jwt2).toBe(jwt1);
      expect(tokenFetchCount).toBe(1); // Still 1, cache was used
    });

    it('should fetch fresh JWT when cache expired', async () => {
      const adapter = createAdapter();

      // Create session with short-lived JWT (expires in 1 second)
      const expiresAt1 = Math.floor(Date.now() / 1000) + 1;
      const mockJwt1 = generateJwt(expiresAt1);

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
              token: mockJwt1,
              expiresAt: expiresAt1,
            },
          });
        })
      );

      await adapter.signUp({
        email: 'test@example.com',
        password: 'password123',
      });

      // Mock token endpoint with fresh JWT
      const expiresAt2 = Math.floor(Date.now() / 1000) + 3600;
      const mockJwt2 = generateJwt(expiresAt2);

      server.use(
        http.post('http://localhost:3000/api/auth/token', () => {
          return HttpResponse.json({ token: mockJwt2 });
        })
      );

      // Get first token
      const jwt1 = await adapter.getJwtToken();
      expect(jwt1).toBeTruthy();

      // Wait for expiration + buffer (10 seconds)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Get second token - should be fresh (different from first)
      const jwt2 = await adapter.getJwtToken();
      expect(jwt2).not.toBe(jwt1);
    });

    it('should return null when session expired', async () => {
      const adapter = createAdapter();

      // Create session with expired JWT
      const expiresAt = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
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

      await adapter.signUp({
        email: 'test@example.com',
        password: 'password123',
      });

      const jwt = await adapter.getJwtToken();
      expect(jwt).toBeNull();
    });

    it('should deduplicate concurrent JWT fetches', async () => {
      const adapter = createAdapter();

      // Create session
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

      await adapter.signUp({
        email: 'test@example.com',
        password: 'password123',
      });

      // Mock token endpoint and count calls
      let fetchCount = 0;
      server.use(
        http.post('http://localhost:3000/api/auth/token', () => {
          fetchCount++;
          // Simulate network delay
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(HttpResponse.json({ token: mockJwt }));
            }, 50);
          });
        })
      );

      // Make 10 concurrent requests
      const promises = Array.from({ length: 10 }, () =>
        adapter.getJwtToken()
      );
      const results = await Promise.all(promises);

      // All should return same token
      const uniqueTokens = new Set(results.filter((t) => t !== null));
      expect(uniqueTokens.size).toBe(1);

      // Should only make 1 network request (deduplication works)
      expect(fetchCount).toBe(1);
    });

    it('should clear cache on sign out', async () => {
      const adapter = createAdapter();

      // Create session
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

      await adapter.signUp({
        email: 'test@example.com',
        password: 'password123',
      });

      // Mock token endpoint
      server.use(
        http.post('http://localhost:3000/api/auth/token', () => {
          return HttpResponse.json({ token: mockJwt });
        })
      );

      // Get JWT (should cache it)
      const jwt1 = await adapter.getJwtToken();
      expect(jwt1).toBeTruthy();

      // Sign out
      server.use(
        http.post('http://localhost:3000/api/auth/sign-out', () => {
          return HttpResponse.json({ success: true });
        })
      );

      await adapter.signOut();

      // JWT should be cleared
      const jwt2 = await adapter.getJwtToken();
      expect(jwt2).toBeNull();
    });
  });

  describe('getSession', () => {
    it('should include JWT token in session.access_token', async () => {
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

      await adapter.signUp({
        email: 'test@example.com',
        password: 'password123',
      });

      server.use(
        http.post('http://localhost:3000/api/auth/token', () => {
          return HttpResponse.json({ token: mockJwt });
        })
      );

      const { data, error } = await adapter.getSession();

      expect(error).toBeNull();
      expect(data.session).toBeTruthy();
      expect(data.session?.access_token).toBeTruthy();

      // Verify it's a JWT (3 parts separated by dots)
      const parts = data.session!.access_token.split('.');
      expect(parts).toHaveLength(3);
    });

    it('should use cached JWT token', async () => {
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

      await adapter.signUp({
        email: 'test@example.com',
        password: 'password123',
      });

      let tokenFetchCount = 0;
      server.use(
        http.post('http://localhost:3000/api/auth/token', () => {
          tokenFetchCount++;
          return HttpResponse.json({ token: mockJwt });
        })
      );

      // First session call
      await adapter.getSession();
      expect(tokenFetchCount).toBe(1);

      // Second session call should use cached JWT
      await adapter.getSession();
      expect(tokenFetchCount).toBe(1);
    });
  });
});
