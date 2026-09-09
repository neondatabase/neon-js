import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  NEON_AUTH_LEGACY_SESSION_CHALLENGE_COOKIE_NAME,
  NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME,
} from '../constants';
import { handleAuthRequest } from './request';

describe('handleAuthRequest cookie forwarding', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('forwards both canonical and legacy challenge cookies upstream', async () => {
    const legacyCookie = `${NEON_AUTH_LEGACY_SESSION_CHALLENGE_COOKIE_NAME}=legacy-challenge`;
    const canonicalCookie = `${NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME}=canonical-challenge`;
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }));
    const request = new Request(
      'https://app.example.com/callback?neon_auth_session_verifier=verifier',
      {
        headers: {
          Cookie: `unrelated=value; ${legacyCookie}; ${canonicalCookie}`,
        },
      }
    );

    await handleAuthRequest('https://auth.example.com', request, 'get-session');

    const requestInit = fetchSpy.mock.calls[0]?.[1];
    const upstreamHeaders = new Headers(requestInit?.headers);
    expect(upstreamHeaders.get('cookie')).toBe(`${legacyCookie}; ${canonicalCookie}`);
  });
});

describe('handleAuthRequest upstream method (issue #204)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('proxies a POST to the get-session path upstream as GET', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }));
    const request = new Request('https://app.example.com/api/auth/get-session', {
      method: 'POST',
      body: JSON.stringify({ mutation: true }),
      headers: { 'content-type': 'application/json' },
    });

    await handleAuthRequest('https://auth.example.com', request, 'get-session');

    const requestInit = fetchSpy.mock.calls[0]?.[1];
    expect(requestInit?.method).toBe('GET');
    expect(requestInit?.body).toBeUndefined();
  });

  test('keeps the incoming method for POST-declared endpoints', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }));
    const request = new Request('https://app.example.com/api/auth/sign-in/email', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.co' }),
      headers: { 'content-type': 'application/json' },
    });

    await handleAuthRequest('https://auth.example.com', request, 'sign-in/email');

    const requestInit = fetchSpy.mock.calls[0]?.[1];
    expect(requestInit?.method).toBe('POST');
    expect(requestInit?.body).not.toBeUndefined();
  });

  test('falls back to the incoming method for unknown paths', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }));
    const request = new Request('https://app.example.com/api/auth/some-extension', {
      method: 'DELETE',
    });

    await handleAuthRequest('https://auth.example.com', request, 'some-extension');

    const requestInit = fetchSpy.mock.calls[0]?.[1];
    expect(requestInit?.method).toBe('DELETE');
  });
});
