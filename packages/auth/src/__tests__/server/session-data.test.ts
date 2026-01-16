import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { signSessionData, getCookieSecret, sessionToSignedCookie, validateSessionData, type SessionData } from '../../server/session';
import type { BetterAuthSession, BetterAuthUser } from '../../core/better-auth-types';

describe('Session Data Operations', () => {
  const TEST_SECRET = 'test-secret-at-least-32-characters-long!';
  const TEST_USER_ID = 'user-123';
  const TEST_EMAIL = 'test@example.com';

  // Setup environment variable for all tests
  beforeEach(() => {
    process.env.NEON_AUTH_COOKIE_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.NEON_AUTH_COOKIE_SECRET;
  });

  function createTestSessionData(): SessionData {
    return {
      session: {
        id: 'session-123',
        userId: TEST_USER_ID,
        token: 'opaque-token-abc',
        expiresAt: new Date(Date.now() + 3_600_000),
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      } as BetterAuthSession,
      user: {
        id: TEST_USER_ID,
        email: TEST_EMAIL,
        emailVerified: true,
        name: 'Test User',
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as BetterAuthUser,
    };
  }

  describe('Session Data Signing', () => {
    test('should sign session data with nested structure', async () => {
      const sessionData = createTestSessionData();
      const expiresAt = new Date(Date.now() + 3_600_000);
      const secret = getCookieSecret();
      const signedData = await signSessionData(sessionData, expiresAt, secret);

      expect(signedData).toBeTypeOf('string');
      expect(signedData.split('.')).toHaveLength(3); // JWT format
    });

    test('should accept expiresAt as timestamp', async () => {
      const sessionData = createTestSessionData();
      const expiresAt = Date.now() + 3_600_000;
      const secret = getCookieSecret();
      const signedData = await signSessionData(sessionData, expiresAt, secret);

      expect(signedData).toBeTypeOf('string');
    });
  });

  describe('Session Data Validation', () => {
    test('should validate valid session data', async () => {
      const sessionData = createTestSessionData();
      const expiresAt = new Date(Date.now() + 3_600_000);
      const secret = getCookieSecret();
      const signedData = await signSessionData(sessionData, expiresAt, secret);

      const result = await validateSessionData(signedData);

      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload?.user.id).toBe(TEST_USER_ID);
      expect(result.payload?.user.email).toBe(TEST_EMAIL);
      expect(result.payload?.session.id).toBe('session-123');
      expect(result.payload?.session.token).toBe('opaque-token-abc');
    });

    test('should reject session data with wrong secret', async () => {
      const sessionData = createTestSessionData();
      const expiresAt = new Date(Date.now() + 3_600_000);
      const signedData = await signSessionData(sessionData, expiresAt, TEST_SECRET);

      // Change the secret for validation
      process.env.NEON_AUTH_COOKIE_SECRET = 'wrong-secret-at-least-32-characters!';

      const result = await validateSessionData(signedData);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();

      // Restore secret
      process.env.NEON_AUTH_COOKIE_SECRET = TEST_SECRET;
    });

    test('should reject expired session data', async () => {
      const sessionData = createTestSessionData();
      const expiresAt = new Date(Date.now() - 3_600_000); // Expired
      const secret = getCookieSecret();
      const signedData = await signSessionData(sessionData, expiresAt, secret);

      const result = await validateSessionData(signedData);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('exp');
    });

    test('should reject tampered session data', async () => {
      const sessionData = createTestSessionData();
      const expiresAt = new Date(Date.now() + 3_600_000);
      const secret = getCookieSecret();
      const signedData = await signSessionData(sessionData, expiresAt, secret);

      // Tamper with the session data
      const parts = signedData.split('.');
      const tamperedPayload = parts[1].slice(0, -1) + 'X';
      const tamperedData = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      const result = await validateSessionData(tamperedData);

      expect(result.valid).toBe(false);
    });
  });

  describe('Cookie Secret Management', () => {
    const originalEnv = process.env.NEON_AUTH_COOKIE_SECRET;

    beforeEach(() => {
      delete process.env.NEON_AUTH_COOKIE_SECRET;
    });

    afterEach(() => {
      if (originalEnv) {
        process.env.NEON_AUTH_COOKIE_SECRET = originalEnv;
      }
    });

    test('should read secret from environment variable', () => {
      process.env.NEON_AUTH_COOKIE_SECRET = TEST_SECRET;
      const secret = getCookieSecret();
      expect(secret).toBe(TEST_SECRET);
    });

    test('should throw error when secret is missing', () => {
      expect(() => getCookieSecret()).toThrow('Cookie secret is required');
      expect(() => getCookieSecret()).toThrow('NEON_AUTH_COOKIE_SECRET');
    });

    test('should throw error when secret is too short', () => {
      process.env.NEON_AUTH_COOKIE_SECRET = 'short';
      expect(() => getCookieSecret()).toThrow('at least 32 characters');
    });
  });

  describe('Session to Session Data Conversion', () => {
    test('should convert session data to signed cookie', async () => {
      const sessionData = createTestSessionData();
      const result = await sessionToSignedCookie(sessionData);

      expect(result.sessionData).toBeTypeOf('string');
      expect(result.expiresAt).toBeInstanceOf(Date);

      // Validate the session data
      const validation = await validateSessionData(result.sessionData);
      expect(validation.valid).toBe(true);
      expect(validation.payload?.user.id).toBe(TEST_USER_ID);
      expect(validation.payload?.user.email).toBe(TEST_EMAIL);
      expect(validation.payload?.session.id).toBe('session-123');
    });

    test('should use 5-minute TTL or session expiry, whichever is sooner', async () => {
      const sessionData = createTestSessionData();
      sessionData.session.expiresAt = new Date(Date.now() + 7_200_000); // 2 hours

      const result = await sessionToSignedCookie(sessionData);

      // Should use 5-minute TTL, not session expiry
      const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
      const timeDiff = Math.abs(result.expiresAt.getTime() - fiveMinutesFromNow);

      // Allow 1 second tolerance
      expect(timeDiff).toBeLessThan(1000);
    });

    test('should handle session data with Date objects from API', async () => {
      const sessionData = createTestSessionData();

      // Ensure expiresAt is a Date object (as it should be after parsing)
      expect(sessionData.session.expiresAt).toBeInstanceOf(Date);
      expect(typeof sessionData.session.expiresAt.getTime).toBe('function');

      // Should successfully create signed cookie without throwing
      const result = await sessionToSignedCookie(sessionData);
      expect(result.sessionData).toBeTypeOf('string');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });
  });
});
