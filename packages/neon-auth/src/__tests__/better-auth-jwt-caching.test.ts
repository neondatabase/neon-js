/**
 * JWT Caching Tests for BetterAuthAdapter
 *
 * Tests JWT token caching behavior, cache invalidation, and request deduplication.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SupabaseAuthAdapter } from '../adapters/supabase/supabase-adapter';
import { server } from './msw-setup';
import { http, HttpResponse } from 'msw';

// =============================================================================
// Helper Functions
// =============================================================================

function createAdapter() {
  return new SupabaseAuthAdapter({
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

    it('should bypass cache when forceFetch is true', async () => {
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
              emailVerified: false,
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
      let emailVerifiedOnServer = false;
      server.use(
        http.post('http://localhost:3000/api/auth/token', () => {
          tokenFetchCount++;
          return HttpResponse.json({ token: mockJwt });
        }),
        http.post('http://localhost:3000/api/auth/get-session', () => {
          return new HttpResponse(null, {
            status: 200,
            headers: {
              'set-auth-jwt': mockJwt,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user: {
                id: 'user123',
                email: 'test@example.com',
                name: null,
                createdAt: new Date().toISOString(),
                emailVerified: emailVerifiedOnServer,
              },
              session: {
                token: mockJwt,
                expiresAt,
              },
            }),
          });
        })
      );

      // First session call (populates cache)
      const session1 = await adapter.getSession();
      expect(session1.data.session?.user.email_confirmed_at).toBeFalsy();
      expect(tokenFetchCount).toBe(1);

      // Simulate email verification on server
      emailVerifiedOnServer = true;

      // Call without forceFetch (should use cache, emailVerified still false)
      const session2 = await adapter.getSession();
      expect(session2.data.session?.user.email_confirmed_at).toBeFalsy();
      expect(tokenFetchCount).toBe(1); // Still 1, cache was used

      // Call with forceFetch: true (should bypass cache and get updated data)
      const session3 = await adapter.getSession({ forceFetch: true });
      expect(session3.data.session?.user.email_confirmed_at).toBeTruthy();
      expect(tokenFetchCount).toBe(2); // Cache was bypassed, new request made

      // Call without forceFetch again (should use new cache)
      const session4 = await adapter.getSession();
      expect(session4.data.session?.user.email_confirmed_at).toBeTruthy();
      expect(tokenFetchCount).toBe(2); // Still 2, new cache was used
    });

    it('should use cache when forceFetch is false or omitted', async () => {
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

      let sessionFetchCount = 0;
      server.use(
        http.post('http://localhost:3000/api/auth/token', () => {
          return HttpResponse.json({ token: mockJwt });
        }),
        http.post('http://localhost:3000/api/auth/get-session', () => {
          sessionFetchCount++;
          return new HttpResponse(null, {
            status: 200,
            headers: {
              'set-auth-jwt': mockJwt,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
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
            }),
          });
        })
      );

      // First call (populates cache)
      await adapter.getSession();
      expect(sessionFetchCount).toBe(1);

      // Call with forceFetch: false (should use cache)
      await adapter.getSession({ forceFetch: false });
      expect(sessionFetchCount).toBe(1); // Cache was used

      // Call without options (should use cache)
      await adapter.getSession();
      expect(sessionFetchCount).toBe(1); // Cache was used
    });
  });
});
