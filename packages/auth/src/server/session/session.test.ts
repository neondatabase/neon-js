import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { validateSessionData } from './validator';
import { signSessionDataCookie, parseSessionData, getSessionDataFromCookie, isSessionCacheEnabled } from './operations';
import { getCookieSecret } from './signer';
import { ERRORS } from '@/server/errors';
import type { RequireSessionData } from '@/server/types';
import type { BetterAuthSession, BetterAuthUser } from '@/core/better-auth-types';


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

const createTestSessionData = (expiresAt: Date = new Date(Date.now() + 3_600_000)): RequireSessionData => {
  return {
    session: {
      id: 'session-123',
      userId: TEST_USER_ID,
      token: 'opaque-token-abc',
      expiresAt,
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

describe('validateSessionData', () => {
  test('should validate valid session data', async () => {
    const sessionData = createTestSessionData();
    const cookie = await signSessionDataCookie(sessionData);

    const result = await validateSessionData(cookie.value);
    expect(result.valid).toBe(true);
    expect(result.payload).toBeDefined();
    expect(result.payload).toEqual(
      expect.objectContaining({
        session: expect.objectContaining({
          id: 'session-123',
          token: 'opaque-token-abc',
        }),
        user: expect.objectContaining({
          id: TEST_USER_ID,
          email: TEST_EMAIL,
        }),
      })
    );
  });

  test('should reject session data with wrong secret', async () => {
    const sessionData = createTestSessionData();
    const cookie = await signSessionDataCookie(sessionData);

    // Change the secret for validation
    process.env.NEON_AUTH_COOKIE_SECRET = 'wrong-secret-at-least-32-characters!';
    const result = await validateSessionData(cookie.value);

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();

    // Restore secret
    process.env.NEON_AUTH_COOKIE_SECRET = TEST_SECRET;
  });

  test('should reject expired session data', async () => {
    const sessionData = createTestSessionData(new Date(Date.now() - 3_600_000));
    const cookie = await signSessionDataCookie(sessionData);

    const result = await validateSessionData(cookie.value);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('exp');
  });

  test('should reject tampered session data', async () => {
    const sessionData = createTestSessionData();
    const cookie = await signSessionDataCookie(sessionData);

    const parts = cookie.value.split('.');
    const tamperedPayload = parts[1].slice(0, -1) + 'X';
    const tamperedData = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const result = await validateSessionData(tamperedData);

    expect(result.valid).toBe(false);
  });

  test('should reject non-JWT format strings', async () => {
    const result = await validateSessionData('not-a-jwt-token');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('should reject JWT with missing parts', async () => {
    const result = await validateSessionData('header.payload'); // Missing signature
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('should reject empty cookie value', async () => {
    const result = await validateSessionData('');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('signSessionDataCookie', () => {
  test('should convert session data to signed cookie', async () => {
    const sessionData = createTestSessionData();
    const result = await signSessionDataCookie(sessionData);

    expect(result.value).toBeTypeOf('string');
    expect(result.expiresAt).toBeInstanceOf(Date);

    // Validate the session data
    const validation = await validateSessionData(result.value);
    expect(validation.valid).toBe(true);
    expect(validation.payload?.user?.id).toBe(TEST_USER_ID);
    expect(validation.payload?.user?.email).toBe(TEST_EMAIL);
    expect(validation.payload?.session?.id).toBe('session-123');
    expect(validation.payload?.session?.token).toBe('opaque-token-abc');
  });

  test('should use 5-minute TTL or session expiry, whichever is sooner', async () => {
    const sessionData = createTestSessionData();
    sessionData.session.expiresAt = new Date(Date.now() + 7_200_000); // 2 hours

    const result = await signSessionDataCookie(sessionData);

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
    const result = await signSessionDataCookie(sessionData);
    expect(result.value).toBeTypeOf('string');
    expect(result.expiresAt).toBeInstanceOf(Date);
  });

  test('should use session expiry when less than 5-minute TTL', async () => {
    const twoMinutesFromNow = new Date(Date.now() + 2 * 60 * 1000);
    const sessionData = createTestSessionData(twoMinutesFromNow);

    const result = await signSessionDataCookie(sessionData);

    // Should use session expiry (2 min), not 5-min TTL
    const timeDiff = Math.abs(result.expiresAt.getTime() - twoMinutesFromNow.getTime());
    expect(timeDiff).toBeLessThan(1000); // 1 second tolerance
  });
});

describe('Environment Variable Handling', () => {
  const originalSecret = process.env.NEON_AUTH_COOKIE_SECRET;

  afterEach(() => {
    process.env.NEON_AUTH_COOKIE_SECRET = originalSecret;
  });

  test('isSessionCacheEnabled returns false when secret is missing', () => {
    delete process.env.NEON_AUTH_COOKIE_SECRET;
    expect(isSessionCacheEnabled()).toBe(false);
  });

  test('isSessionCacheEnabled returns true when secret is set', () => {
    process.env.NEON_AUTH_COOKIE_SECRET = TEST_SECRET;
    expect(isSessionCacheEnabled()).toBe(true);
  });

  test('getCookieSecret throws when secret is missing', () => {
    delete process.env.NEON_AUTH_COOKIE_SECRET;
    expect(() => getCookieSecret()).toThrow(ERRORS.MISSING_COOKIE_SECRET);
  });

  test('getCookieSecret throws when secret is too short', () => {
    process.env.NEON_AUTH_COOKIE_SECRET = 'short'; // < 32 chars
    expect(() => getCookieSecret()).toThrow(ERRORS.COOKIE_SECRET_TOO_SHORT);
  });
});

describe('parseSessionData', () => {
  test('parses valid ISO date strings', () => {
    const json = {
      session: {
        id: 'session-123',
        userId: 'user-123',
        token: 'token-abc',
        expiresAt: '2026-01-20T00:00:00.000Z', // ISO string
        createdAt: '2026-01-18T00:00:00.000Z',
        updatedAt: '2026-01-18T00:00:00.000Z',
        ipAddress: '127.0.0.1',
        userAgent: 'test',
      },
      user: {
        id: 'user-123',
        email: 'test@example.com',
        emailVerified: true,
        name: 'Test User',
        image: null,
        createdAt: '2026-01-18T00:00:00.000Z',
        updatedAt: '2026-01-18T00:00:00.000Z',
      },
    };

    const result = parseSessionData(json);
    expect(result.session?.expiresAt).toBeInstanceOf(Date);
    expect(result.session?.expiresAt.getTime()).toBeGreaterThan(0);
    expect(result.user?.createdAt).toBeInstanceOf(Date);
  });

  test('handles missing session/user gracefully', () => {
    const result = parseSessionData({});
    expect(result.session).toBe(null);
    expect(result.user).toBe(null);
  });

  test('handles null session in response', () => {
    const result = parseSessionData({ session: null, user: null });
    expect(result.session).toBe(null);
    expect(result.user).toBe(null);
  });

  test('returns null session on invalid date strings', () => {
    const json = {
      session: {
        id: 'session-123',
        userId: 'user-123',
        token: 'token-abc',
        expiresAt: 'not-a-date',
        createdAt: '2026-01-18T00:00:00.000Z',
        updatedAt: '2026-01-18T00:00:00.000Z',
        ipAddress: '127.0.0.1',
        userAgent: 'test',
      },
      user: {
        id: 'user-123',
        email: 'test@example.com',
        emailVerified: true,
        name: 'Test User',
        image: null,
        createdAt: '2026-01-18T00:00:00.000Z',
        updatedAt: '2026-01-18T00:00:00.000Z',
      },
    };

    // After error handling improvements, this should return null session
    const result = parseSessionData(json);
    expect(result.session).toBe(null);
    expect(result.user).toBe(null);
  });

  test('handles null/undefined input', () => {
    expect(parseSessionData(null)).toEqual({ session: null, user: null });
    expect(parseSessionData(undefined)).toEqual({ session: null, user: null });
  });
});

describe('getSessionDataFromCookie', () => {
  test('returns null when cookie header is missing', async () => {
    const request = new Request('https://example.com', {});
    const result = await getSessionDataFromCookie(request, 'session_data');
    expect(result).toBe(null);
  });

  test('returns null when target cookie is not present', async () => {
    const request = new Request('https://example.com', {
      headers: { Cookie: 'other_cookie=value' },
    });
    const result = await getSessionDataFromCookie(request, 'session_data');
    expect(result).toBe(null);
  });

  test('extracts and validates session data from valid cookie', async () => {
    const sessionData = createTestSessionData();
    const cookie = await signSessionDataCookie(sessionData);

    const request = new Request('https://example.com', {
      headers: { Cookie: `session_data=${cookie.value}` },
    });

    const result = await getSessionDataFromCookie(request, 'session_data');
    expect(result).not.toBe(null);
    expect(result?.session?.id).toBe('session-123');
    expect(result?.user?.id).toBe(TEST_USER_ID);
  });

  test('returns null for invalid cookie signature', async () => {
    const request = new Request('https://example.com', {
      headers: { Cookie: 'session_data=invalid.jwt.token' },
    });

    const result = await getSessionDataFromCookie(request, 'session_data');
    expect(result).toBe(null);
  });

  test('handles multiple cookies in header', async () => {
    const sessionData = createTestSessionData();
    const cookie = await signSessionDataCookie(sessionData);

    const request = new Request('https://example.com', {
      headers: {
        Cookie: `other=value; session_data=${cookie.value}; another=123`,
      },
    });

    const result = await getSessionDataFromCookie(request, 'session_data');
    expect(result?.session?.id).toBe('session-123');
  });
});
