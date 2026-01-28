import { describe, test, expect, vi, beforeEach } from 'vitest';
import { needsSessionVerification, exchangeOAuthToken } from './oauth';
import * as proxy from '../proxy';
import { NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME } from '../constants';

const TEST_SECRET = 'test-secret-at-least-32-characters-long!';
const VERIFIER_PARAM = 'neon_auth_session_verifier';

describe('needsSessionVerification', () => {
  test('returns true when both verifier and challenge are present', () => {
    const request = new Request(`https://example.com/?${VERIFIER_PARAM}=test-verifier`, {
      headers: {
        Cookie: `${NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME}=test-challenge`,
      },
    });

    expect(needsSessionVerification(request)).toBe(true);
  });

  test('returns false when verifier is missing', () => {
    const request = new Request('https://example.com/', {
      headers: {
        Cookie: `${NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME}=test-challenge`,
      },
    });

    expect(needsSessionVerification(request)).toBe(false);
  });

  test('returns false when challenge cookie is missing', () => {
    const request = new Request(`https://example.com/?${VERIFIER_PARAM}=test-verifier`);

    expect(needsSessionVerification(request)).toBe(false);
  });

  test('returns false when no cookies at all', () => {
    const request = new Request(`https://example.com/?${VERIFIER_PARAM}=test-verifier`);

    expect(needsSessionVerification(request)).toBe(false);
  });

  test('returns false when neither verifier nor challenge present', () => {
    const request = new Request('https://example.com/');

    expect(needsSessionVerification(request)).toBe(false);
  });

  test('handles multiple cookies correctly', () => {
    const request = new Request(`https://example.com/?${VERIFIER_PARAM}=test-verifier`, {
      headers: {
        Cookie: `other=value; ${NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME}=test-challenge; another=123`,
      },
    });

    expect(needsSessionVerification(request)).toBe(true);
  });

  test('handles multiple query parameters correctly', () => {
    const request = new Request(`https://example.com/?foo=bar&${VERIFIER_PARAM}=test-verifier&baz=qux`, {
      headers: {
        Cookie: `${NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME}=test-challenge`,
      },
    });

    expect(needsSessionVerification(request)).toBe(true);
  });
});

describe('exchangeOAuthToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns exchange result on successful OAuth flow', async () => {
    // Mock successful upstream response
    const mockUpstreamResponse = Response.json(
      { session: { id: 'session-123' }, user: { id: 'user-123' } },
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': '__Secure-neon-auth.session_token=token-value',
        },
      }
    );

    // Mock the processed response with Set-Cookie headers
    const mockProcessedResponse = new Response('OK', {
      status: 200,
      headers: new Headers({
        'set-cookie': '__Secure-neon-auth.session_token=token-value',
        'Set-Cookie': '__Secure-neon-auth.local.session_data=data-value',
      }),
    });

    vi.spyOn(proxy, 'handleAuthRequest').mockResolvedValue(mockUpstreamResponse);
    vi.spyOn(proxy, 'handleAuthResponse').mockResolvedValue(mockProcessedResponse);

    const request = new Request(
      `https://example.com/dashboard?${VERIFIER_PARAM}=test-verifier&other=param`,
      {
        headers: {
          Cookie: `${NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME}=test-challenge`,
        },
      }
    );

    const result = await exchangeOAuthToken(request, 'https://auth.example.com', TEST_SECRET);

    expect(result).not.toBe(null);
    expect(result?.success).toBe(true);
    expect(result?.cookies).toHaveLength(2);
    expect(result?.cookies[0]).toContain('session_token');

    // Verifier param should be removed from redirect URL
    expect(result?.redirectUrl.searchParams.has(VERIFIER_PARAM)).toBe(false);
    // Other params should be preserved
    expect(result?.redirectUrl.searchParams.get('other')).toBe('param');
  });

  test('returns null when verifier is missing', async () => {
    const request = new Request('https://example.com/dashboard', {
      headers: {
        Cookie: `${NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME}=test-challenge`,
      },
    });

    const result = await exchangeOAuthToken(request, 'https://auth.example.com', TEST_SECRET);

    expect(result).toBe(null);
  });

  test('returns null when challenge cookie is missing', async () => {
    const request = new Request(`https://example.com/dashboard?${VERIFIER_PARAM}=test-verifier`);

    const result = await exchangeOAuthToken(request, 'https://auth.example.com', TEST_SECRET);

    expect(result).toBe(null);
  });

  test('returns null when cookie header is missing', async () => {
    const request = new Request(`https://example.com/dashboard?${VERIFIER_PARAM}=test-verifier`);

    const result = await exchangeOAuthToken(request, 'https://auth.example.com', TEST_SECRET);

    expect(result).toBe(null);
  });

  test('returns null when upstream response is not ok', async () => {
    const mockUpstreamResponse = new Response('Unauthorized', { status: 401 });
    const mockProcessedResponse = new Response('Unauthorized', { status: 401 });

    vi.spyOn(proxy, 'handleAuthRequest').mockResolvedValue(mockUpstreamResponse);
    vi.spyOn(proxy, 'handleAuthResponse').mockResolvedValue(mockProcessedResponse);

    const request = new Request(`https://example.com/dashboard?${VERIFIER_PARAM}=test-verifier`, {
      headers: {
        Cookie: `${NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME}=test-challenge`,
      },
    });

    const result = await exchangeOAuthToken(request, 'https://auth.example.com', TEST_SECRET);

    expect(result).toBe(null);
  });

  test('extracts multiple Set-Cookie headers', async () => {
    const mockUpstreamResponse = Response.json({}, { status: 200 });

    const headers = new Headers();
    headers.append('Set-Cookie', '__Secure-neon-auth.session_token=token-value');
    headers.append('Set-Cookie', '__Secure-neon-auth.session_data=data-value');

    const mockProcessedResponse = new Response('OK', { status: 200, headers });

    vi.spyOn(proxy, 'handleAuthRequest').mockResolvedValue(mockUpstreamResponse);
    vi.spyOn(proxy, 'handleAuthResponse').mockResolvedValue(mockProcessedResponse);

    const request = new Request(`https://example.com/dashboard?${VERIFIER_PARAM}=test-verifier`, {
      headers: {
        Cookie: `${NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME}=test-challenge`,
      },
    });

    const result = await exchangeOAuthToken(request, 'https://auth.example.com', TEST_SECRET);

    expect(result?.cookies).toHaveLength(2);
    expect(result?.cookies[0]).toContain('session_token');
    expect(result?.cookies[1]).toContain('session_data');
  });

  test('preserves URL path and other query params in redirect', async () => {
    const mockUpstreamResponse = Response.json({}, { status: 200 });
    const mockProcessedResponse = new Response('OK', {
      status: 200,
      headers: new Headers({ 'Set-Cookie': 'session_token=value' }),
    });

    vi.spyOn(proxy, 'handleAuthRequest').mockResolvedValue(mockUpstreamResponse);
    vi.spyOn(proxy, 'handleAuthResponse').mockResolvedValue(mockProcessedResponse);

    const request = new Request(
      `https://example.com/some/path?foo=bar&${VERIFIER_PARAM}=verifier&baz=qux`,
      {
        headers: {
          Cookie: `${NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME}=test-challenge`,
        },
      }
    );

    const result = await exchangeOAuthToken(request, 'https://auth.example.com', TEST_SECRET);

    expect(result?.redirectUrl.pathname).toBe('/some/path');
    expect(result?.redirectUrl.searchParams.get('foo')).toBe('bar');
    expect(result?.redirectUrl.searchParams.get('baz')).toBe('qux');
    expect(result?.redirectUrl.searchParams.has(VERIFIER_PARAM)).toBe(false);
  });
});
