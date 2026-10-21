import { describe, test, expect } from 'vitest';
import { deriveBetterAuthMethodFromUrl } from './better-auth-methods';

describe('deriveBetterAuthMethodFromUrl', () => {
  test.each([
    ['https://a.example.com/api/auth/token', 'getSession'],
    ['https://a.example.com/api/auth/get-session', 'getSession'],
    ['https://a.example.com/api/auth/token/anonymous', 'anonymousToken'],
    ['https://a.example.com/api/auth/sign-in/email', 'signIn'],
  ])('%s -> %s', (url, expected) => {
    expect(deriveBetterAuthMethodFromUrl(url)).toBe(expected);
  });

  test.each([
    'token',
    'consent',
    'continue',
    'public-client',
    'public-client-prelogin',
    'get-consent',
    'get-consents',
    'update-consent',
    'delete-consent',
    'introspect',
  ])('/oauth2/%s is not a session method', (name) => {
    expect(
      deriveBetterAuthMethodFromUrl(`https://a.example.com/api/auth/oauth2/${name}`)
    ).toBeUndefined();
  });

  test('a host named oauth2 does not suppress classification', () => {
    expect(
      deriveBetterAuthMethodFromUrl('https://oauth2.example.com/api/auth/token')
    ).toBe('getSession');
  });

  test('/oauth2/ in the query string does not suppress classification', () => {
    expect(
      deriveBetterAuthMethodFromUrl(
        'https://a.example.com/api/auth/token?next=/oauth2/x'
      )
    ).toBe('getSession');
  });
});
