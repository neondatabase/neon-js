import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { maybeRefreshSessionDataAfterResponse } from './post-response-refresh';
import { handleAuthResponse } from '../proxy/response';
import { NEON_AUTH_SESSION_COOKIE_NAME, NEON_AUTH_SESSION_DATA_COOKIE_NAME } from '../constants';
import type { RequireSessionData } from '@/server/types';
import type { BetterAuthSession, BetterAuthUser } from '@/core/better-auth-types';

const TEST_SECRET = 'test-secret-at-least-32-characters-long!';
const TEST_BASE_URL = 'https://auth.example.com';
const TEST_COOKIE_CONFIG = {
  secret: TEST_SECRET,
  sessionDataTtl: 300,
};
const SESSION_TOKEN_COOKIE_HEADER = `${NEON_AUTH_SESSION_COOKIE_NAME}=valid-token`;

const createTestSessionData = (): RequireSessionData => ({
  session: {
    id: 'session-123',
    userId: 'user-123',
    token: 'opaque-token-abc',
    expiresAt: new Date(Date.now() + 3_600_000),
    createdAt: new Date(),
    updatedAt: new Date(),
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
  } as BetterAuthSession,
  user: {
    id: 'user-123',
    email: 'test@example.com',
    emailVerified: true,
    name: 'Test User',
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as BetterAuthUser,
});

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('maybeRefreshSessionDataAfterResponse', () => {
  test('case 1: 2xx JSON with top-level user → returns remint Set-Cookie string', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/get-session`, () => HttpResponse.json(createTestSessionData()))
    );

    const response = Response.json(
      { user: { id: 'user-123', email: 'new@example.com' } },
      { status: 200, headers: { 'content-type': 'application/json' } }
    );

    const result = await maybeRefreshSessionDataAfterResponse({
      requestCookieHeader: SESSION_TOKEN_COOKIE_HEADER,
      response,
      baseUrl: TEST_BASE_URL,
      cookieConfig: TEST_COOKIE_CONFIG,
      alreadyMintedFromHeader: false,
    });

    expect(result).not.toBe(null);
    expect(result).toContain(`${NEON_AUTH_SESSION_DATA_COOKIE_NAME}=`);
    expect(result).toContain('HttpOnly');
  });

  test('case 2: /update-user response with {user, session} → returns remint cookie', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/get-session`, () => HttpResponse.json(createTestSessionData()))
    );

    const response = Response.json(
      {
        user: { id: 'user-123', name: 'Updated' },
        session: { id: 'session-123', token: 'opaque-token-abc' },
      },
      { status: 200, headers: { 'content-type': 'application/json' } }
    );

    const result = await maybeRefreshSessionDataAfterResponse({
      requestCookieHeader: SESSION_TOKEN_COOKIE_HEADER,
      response,
      baseUrl: TEST_BASE_URL,
      cookieConfig: TEST_COOKIE_CONFIG,
      alreadyMintedFromHeader: false,
    });

    expect(result).not.toBe(null);
    expect(result).toContain(`${NEON_AUTH_SESSION_DATA_COOKIE_NAME}=`);
  });

  test('case 3: 2xx JSON without user/session → returns null', async () => {
    const response = Response.json({ ok: true, message: 'done' }, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    const result = await maybeRefreshSessionDataAfterResponse({
      requestCookieHeader: SESSION_TOKEN_COOKIE_HEADER,
      response,
      baseUrl: TEST_BASE_URL,
      cookieConfig: TEST_COOKIE_CONFIG,
      alreadyMintedFromHeader: false,
    });

    expect(result).toBe(null);
  });

  test('case 4: 2xx but non-JSON (text/html) → returns null', async () => {
    const response = new Response('<html><body>ok</body></html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    });

    const result = await maybeRefreshSessionDataAfterResponse({
      requestCookieHeader: SESSION_TOKEN_COOKIE_HEADER,
      response,
      baseUrl: TEST_BASE_URL,
      cookieConfig: TEST_COOKIE_CONFIG,
      alreadyMintedFromHeader: false,
    });

    expect(result).toBe(null);
  });

  test('case 5: missing session_token in request cookies → returns null even for qualifying body', async () => {
    const response = Response.json({ user: { id: 'user-123' } }, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    const result = await maybeRefreshSessionDataAfterResponse({
      requestCookieHeader: 'other-cookie=value',
      response,
      baseUrl: TEST_BASE_URL,
      cookieConfig: TEST_COOKIE_CONFIG,
      alreadyMintedFromHeader: false,
    });

    expect(result).toBe(null);
  });

  test('case 6: mintSessionDataFromToken fails → returns deletion cookie (Max-Age=0)', async () => {
    // Upstream returns 401 so minting fails — we should emit a deletion cookie.
    server.use(
      http.get(`${TEST_BASE_URL}/get-session`, () =>
        HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
      )
    );

    const response = Response.json({ user: { id: 'user-123' } }, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    const result = await maybeRefreshSessionDataAfterResponse({
      requestCookieHeader: SESSION_TOKEN_COOKIE_HEADER,
      response,
      baseUrl: TEST_BASE_URL,
      cookieConfig: TEST_COOKIE_CONFIG,
      alreadyMintedFromHeader: false,
    });

    expect(result).not.toBe(null);
    expect(result).toContain(`${NEON_AUTH_SESSION_DATA_COOKIE_NAME}=`);
    expect(result).toContain('Max-Age=0');
  });

  test('alreadyMintedFromHeader=true short-circuits before touching body', async () => {
    const response = Response.json({ user: { id: 'user-123' } }, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    const result = await maybeRefreshSessionDataAfterResponse({
      requestCookieHeader: SESSION_TOKEN_COOKIE_HEADER,
      response,
      baseUrl: TEST_BASE_URL,
      cookieConfig: TEST_COOKIE_CONFIG,
      alreadyMintedFromHeader: true,
    });

    expect(result).toBe(null);
  });

  test('non-2xx response is skipped', async () => {
    const response = Response.json({ user: { id: 'user-123' } }, {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });

    const result = await maybeRefreshSessionDataAfterResponse({
      requestCookieHeader: SESSION_TOKEN_COOKIE_HEADER,
      response,
      baseUrl: TEST_BASE_URL,
      cookieConfig: TEST_COOKIE_CONFIG,
      alreadyMintedFromHeader: false,
    });

    expect(result).toBe(null);
  });

  test('wrapped body shape { data: { user } } is matched', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/get-session`, () => HttpResponse.json(createTestSessionData()))
    );

    const response = Response.json(
      { data: { user: { id: 'user-123' } } },
      { status: 200, headers: { 'content-type': 'application/json' } }
    );

    const result = await maybeRefreshSessionDataAfterResponse({
      requestCookieHeader: SESSION_TOKEN_COOKIE_HEADER,
      response,
      baseUrl: TEST_BASE_URL,
      cookieConfig: TEST_COOKIE_CONFIG,
      alreadyMintedFromHeader: false,
    });

    expect(result).not.toBe(null);
    expect(result).toContain(`${NEON_AUTH_SESSION_DATA_COOKIE_NAME}=`);
  });
});

describe('handleAuthResponse integration', () => {
  test('simulated mutation response → Response has Set-Cookie: session_data=', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/get-session`, () => HttpResponse.json(createTestSessionData()))
    );

    // Upstream response: 2xx JSON with user body, no Set-Cookie headers
    // (mirrors Better Auth's /update-user return shape).
    const upstream = Response.json(
      { user: { id: 'user-123', name: 'Updated' } },
      { status: 200, headers: { 'content-type': 'application/json' } }
    );

    const processed = await handleAuthResponse(
      upstream,
      TEST_BASE_URL,
      TEST_COOKIE_CONFIG,
      { cookieHeader: SESSION_TOKEN_COOKIE_HEADER }
    );

    const setCookies = processed.headers.getSetCookie();
    const sessionDataCookie = setCookies.find((c) =>
      c.startsWith(`${NEON_AUTH_SESSION_DATA_COOKIE_NAME}=`)
    );

    expect(sessionDataCookie).toBeDefined();
    expect(sessionDataCookie).toContain('HttpOnly');
  });

  test('no requestContext → no session_data Set-Cookie on plain mutation', async () => {
    // Without requestContext the fallback is disabled — preserves prior behavior
    // for callers that haven't opted in.
    const upstream = Response.json(
      { user: { id: 'user-123' } },
      { status: 200, headers: { 'content-type': 'application/json' } }
    );

    const processed = await handleAuthResponse(
      upstream,
      TEST_BASE_URL,
      TEST_COOKIE_CONFIG
    );

    const setCookies = processed.headers.getSetCookie();
    const sessionDataCookie = setCookies.find((c) =>
      c.startsWith(`${NEON_AUTH_SESSION_DATA_COOKIE_NAME}=`)
    );

    expect(sessionDataCookie).toBeUndefined();
  });
});
