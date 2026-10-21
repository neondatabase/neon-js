import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { jwt } from 'better-auth/plugins/jwt';
import { oauthProvider } from '@better-auth/oauth-provider';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { processAuthMiddleware } from './processor';

const APP = 'https://app.example.com';
const AUTH_BASE = 'https://auth.example.com/api/auth';
const REDIRECT_URI = 'https://rp.example.com/cb';

const auth = betterAuth({
  baseURL: AUTH_BASE,
  secret: 'test-secret-at-least-32-characters-long!',
  database: memoryAdapter({
    user: [],
    session: [],
    account: [],
    verification: [],
    jwks: [],
    oauthClient: [],
    oauthRefreshToken: [],
    oauthAccessToken: [],
    oauthConsent: [],
  }),
  trustedOrigins: [APP],
  emailAndPassword: { enabled: true },
  advanced: { cookiePrefix: 'neon-auth', useSecureCookies: true },
  plugins: [
    jwt(),
    oauthProvider({
      loginPage: '/auth/sign-in',
      consentPage: `${APP}/consent`,
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
    }),
  ],
});

function cookieHeaderFrom(setCookies: string[]): string {
  return setCookies.map((c) => c.split(';')[0]).join('; ');
}

let sessionCookie = '';
let loginSearch = '';

async function authorize(cookie: string, clientId: string): Promise<Response> {
  const url = new URL(`${AUTH_BASE}/oauth2/authorize`);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    scope: 'openid',
    state: 'xyz',
    code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    code_challenge_method: 'S256',
  }).toString();
  return auth.handler(
    new Request(url, { headers: cookie ? { cookie } : {}, redirect: 'manual' })
  );
}

beforeAll(async () => {
  const signUp = await auth.handler(
    new Request(`${AUTH_BASE}/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: APP },
      body: JSON.stringify({ email: 'u@example.com', password: 'password-12345', name: 'U' }),
    })
  );
  sessionCookie = cookieHeaderFrom(signUp.headers.getSetCookie());

  const register = await auth.handler(
    new Request(`${AUTH_BASE}/oauth2/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        redirect_uris: [REDIRECT_URI],
        token_endpoint_auth_method: 'none',
        client_name: 'rp',
      }),
    })
  );
  const { client_id } = (await register.json()) as { client_id: string };

  const redirect = await authorize('', client_id);
  loginSearch = new URL(redirect.headers.get('location')!, APP).search;
});

function routeFetchToAuth() {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init?: RequestInit) => auth.handler(new Request(input, init)))
  );
}

function runMiddleware(search: string, cookie: string | null) {
  const request = new Request(`${APP}/auth/sign-in${search}`, {
    headers: cookie ? { cookie } : {},
  });
  return processAuthMiddleware({
    request,
    pathname: '/auth/sign-in',
    skipRoutes: ['/api/auth'],
    loginUrl: '/auth/sign-in',
    baseUrl: AUTH_BASE,
    cookieSecret: 'x'.repeat(32),
  });
}

describe('oauth resume against a real oauthProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('the authorize redirect carries a signed query to the login page', () => {
    expect(sessionCookie).toContain('__Secure-neon-auth.session_token=');
    const params = new URLSearchParams(loginSearch);
    expect(params.has('sig')).toBe(true);
    expect(params.has('ba_param')).toBe(true);
  });

  test('a signed-in user with no prior grant is sent to the consent page', async () => {
    routeFetchToAuth();
    const result = await runMiddleware(loginSearch, sessionCookie);
    expect(result.action).toBe('redirect_oauth');
    if (result.action === 'redirect_oauth') {
      expect(result.redirectUrl.pathname).toBe('/consent');
    }
  });

  test('a tampered signature falls back to the login page', async () => {
    routeFetchToAuth();
    const params = new URLSearchParams(loginSearch);
    params.set('scope', 'openid email');
    const result = await runMiddleware(`?${params.toString()}`, sessionCookie);
    expect(result.action).toBe('allow');
  });

  test('no session falls back to the login page', async () => {
    routeFetchToAuth();
    const result = await runMiddleware(loginSearch, null);
    expect(result.action).toBe('allow');
  });
});
