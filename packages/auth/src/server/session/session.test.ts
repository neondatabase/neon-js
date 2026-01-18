import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { validateSessionData } from './validator';
import { signSessionDataCookie } from './operations';
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
});

