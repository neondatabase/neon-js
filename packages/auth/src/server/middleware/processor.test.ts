import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { processAuthMiddleware } from './processor';
import type { AuthMiddlewareConfig } from './processor';
import type { ResolvedNeonAuthLogging } from '../logger';
import * as oauth from './oauth';
import * as routeProtection from './route-protection';
import * as proxyHandler from '../proxy/handler';

const TEST_SECRET = 'test-secret-at-least-32-characters-long!';
const BASE_URL = 'https://auth.example.com';
const LOGIN_URL = '/auth/sign-in';

const createTestConfig = (overrides?: Partial<AuthMiddlewareConfig>): AuthMiddlewareConfig => ({
  request: new Request('https://app.com/dashboard'),
  pathname: '/dashboard',
  skipRoutes: ['/api/auth', '/public'],
  loginUrl: LOGIN_URL,
  baseUrl: BASE_URL,
  cookieSecret: TEST_SECRET,
  ...overrides,
});

describe('processAuthMiddleware', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('login URL handling', () => {
    test('allows access to login URL without session check', async () => {
      const config = createTestConfig({
        request: new Request('https://app.com/auth/sign-in'),
        pathname: LOGIN_URL,
      });

      const result = await processAuthMiddleware(config);

      expect(result.action).toBe('allow');
    });

    test('allows access to login subpaths', async () => {
      const config = createTestConfig({
        request: new Request('https://app.com/auth/sign-in/email'),
        pathname: '/auth/sign-in/email',
      });

      const result = await processAuthMiddleware(config);

      expect(result.action).toBe('allow');
    });

    test('allows login subpaths when loginUrl has a trailing slash', async () => {
      const config = createTestConfig({
        loginUrl: '/auth/sign-in/',
        request: new Request('https://app.com/auth/sign-in/email'),
        pathname: '/auth/sign-in/email',
      });

      const result = await processAuthMiddleware(config);

      expect(result.action).toBe('allow');
    });

    test('does not allow a local same-path route for an external login URL', async () => {
      const config = createTestConfig({
        loginUrl: 'https://identity.example.com/auth/sign-in',
        request: new Request('https://app.com/auth/sign-in'),
        pathname: '/auth/sign-in',
      });

      const result = await processAuthMiddleware(config);

      expect(result.action).toBe('redirect_login');
    });

    test('does not allow sibling paths sharing the login path prefix', async () => {
      const config = createTestConfig({
        request: new Request('https://app.com/auth/sign-in-admin'),
        pathname: '/auth/sign-in-admin',
      });

      const result = await processAuthMiddleware(config);

      expect(result.action).toBe('redirect_login');
    });
  });

  describe('OAuth flow', () => {
    test('redirects with cookies on successful OAuth exchange', async () => {
      const mockRedirectUrl = new URL('https://app.com/dashboard');
      const mockCookies = ['session_token=abc', 'session_data=xyz'];

      vi.spyOn(oauth, 'exchangeOAuthToken').mockResolvedValue({
        redirectUrl: mockRedirectUrl,
        cookies: mockCookies,
        success: true,
      });

      const config = createTestConfig({
        request: new Request('https://app.com/dashboard?neon_auth_session_verifier=verifier', {
          headers: { Cookie: '__Secure-neon-auth.session_challange=challenge' },
        }),
      });

      const result = await processAuthMiddleware(config);

      expect(result.action).toBe('redirect_oauth');
      if (result.action === 'redirect_oauth') {
        expect(result.redirectUrl).toBe(mockRedirectUrl);
        expect(result.cookies).toEqual(mockCookies);
      }
    });

    test('continues to session check when OAuth exchange returns null', async () => {
      vi.spyOn(oauth, 'exchangeOAuthToken').mockResolvedValue(null);
      vi.spyOn(routeProtection, 'checkSessionRequired').mockReturnValue({
        allowed: false,
        requiresRedirect: true,
      });

      const config = createTestConfig();

      const result = await processAuthMiddleware(config);

      // Should continue to session check, not return early
      expect(result.action).toBe('redirect_login');
    });

    test('skips OAuth flow when verification not needed', async () => {
      const exchangeSpy = vi.spyOn(oauth, 'exchangeOAuthToken');
      
      const config = createTestConfig();
      await processAuthMiddleware(config);

      expect(exchangeSpy).not.toHaveBeenCalled();
    });
  });

  describe('session handling', () => {
    test('skips upstream call when session cookie is missing', async () => {
      const handleAuthProxyRequestSpy = vi.spyOn(proxyHandler, 'handleAuthProxyRequest');
      
      const config = createTestConfig({
        request: new Request('https://app.com/dashboard'),
      });

      await processAuthMiddleware(config);

      // Should NOT call handleAuthProxyRequest when no session cookie
      expect(handleAuthProxyRequestSpy).not.toHaveBeenCalled();
    });

    test('calls handleAuthProxyRequest when session cookie is present', async () => {
      const sessionResponse = Response.json({
        session: { id: 'session-123' },
        user: { id: 'user-123' },
      });

      const handleAuthProxyRequestSpy = vi
        .spyOn(proxyHandler, 'handleAuthProxyRequest')
        .mockResolvedValue(sessionResponse);
      
      const config = createTestConfig({
        request: new Request('https://app.com/dashboard', {
          headers: { Cookie: '__Secure-neon-auth.session_token=token-value' },
        }),
      });

      await processAuthMiddleware(config);

      expect(handleAuthProxyRequestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          // The lookup uses a normalized GET clone, not the original instance.
          request: expect.any(Request),
          path: 'get-session',
          baseUrl: BASE_URL,
          cookieSecret: TEST_SECRET,
          sessionDataTtl: undefined,
          domain: undefined,
          sameSite: undefined,
          log: expect.any(Object),
        }),
      );
    });

    test('normalizes non-GET requests (e.g. Server Action POST) to a GET session lookup', async () => {
      const sessionResponse = Response.json({
        session: { id: 'session-123' },
        user: { id: 'user-123' },
      });

      const handleAuthProxyRequestSpy = vi
        .spyOn(proxyHandler, 'handleAuthProxyRequest')
        .mockResolvedValue(sessionResponse);

      // Simulate a Next.js Server Action: a POST to the current (protected)
      // page, carrying body-framing headers like a real form submission.
      const config = createTestConfig({
        request: new Request('https://app.com/account/settings', {
          method: 'POST',
          headers: {
            Cookie: '__Secure-neon-auth.session_token=token-value',
            'Content-Type': 'multipart/form-data; boundary=----x',
            'Content-Length': '128',
          },
          body: 'noop',
        }),
        pathname: '/account/settings',
      });

      const result = await processAuthMiddleware(config);

      // The session lookup must use GET so the upstream get-session call (and
      // cookie-cache fast path) work; otherwise an authenticated user would be
      // redirected to login.
      const passedRequest = handleAuthProxyRequestSpy.mock.calls[0][0].request;
      expect(passedRequest.method).toBe('GET');
      // A fresh clone, not the original POST request.
      expect(passedRequest).not.toBe(config.request);
      // Cookies/headers preserved...
      expect(passedRequest.headers.get('Cookie')).toBe(
        '__Secure-neon-auth.session_token=token-value'
      );
      // ...but body-framing headers stripped from the body-less GET.
      expect(passedRequest.headers.get('Content-Type')).toBeNull();
      expect(passedRequest.headers.get('Content-Length')).toBeNull();
      expect(result.action).toBe('allow');
    });

    test('issues a fresh GET lookup request even when the incoming request is GET', async () => {
      const handleAuthProxyRequestSpy = vi
        .spyOn(proxyHandler, 'handleAuthProxyRequest')
        .mockResolvedValue(Response.json({ session: { id: 's' }, user: { id: 'u' } }));

      const config = createTestConfig({
        request: new Request('https://app.com/dashboard', {
          headers: { Cookie: '__Secure-neon-auth.session_token=token-value' },
        }),
      });

      await processAuthMiddleware(config);

      // The lookup is always a fresh GET request (uniform regardless of method),
      // never the original instance, with cookies preserved.
      const passedRequest = handleAuthProxyRequestSpy.mock.calls[0][0].request;
      expect(passedRequest).not.toBe(config.request);
      expect(passedRequest.method).toBe('GET');
      expect(passedRequest.headers.get('Cookie')).toBe(
        '__Secure-neon-auth.session_token=token-value'
      );
    });

    test('forwards pre-resolved log sink to handleAuthProxyRequest', async () => {
      const mockLog: ResolvedNeonAuthLogging = {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
      };

      const handleAuthProxyRequestSpy = vi
        .spyOn(proxyHandler, 'handleAuthProxyRequest')
        .mockResolvedValue(Response.json({ session: null, user: null }));

      vi.spyOn(routeProtection, 'checkSessionRequired').mockReturnValue({
        allowed: true,
        requiresRedirect: false,
      });

      const config = createTestConfig({
        request: new Request('https://app.com/dashboard', {
          headers: { Cookie: '__Secure-neon-auth.session_token=token-value' },
        }),
        log: mockLog,
      });

      await processAuthMiddleware(config);

      expect(handleAuthProxyRequestSpy).toHaveBeenCalledWith(
        expect.objectContaining({ log: mockLog }),
      );
    });

    test('passes session data to checkSessionRequired', async () => {
      const sessionData = {
        session: { id: 'session-123' },
        user: { id: 'user-123', email: 'test@example.com' },
      };

      const sessionResponse = Response.json(sessionData);

      vi.spyOn(proxyHandler, 'handleAuthProxyRequest').mockResolvedValue(sessionResponse);
      const checkSessionRequiredSpy = vi
        .spyOn(routeProtection, 'checkSessionRequired')
        .mockReturnValue({ allowed: true, requiresRedirect: false });

      const config = createTestConfig({
        request: new Request('https://app.com/dashboard', {
          headers: { Cookie: '__Secure-neon-auth.session_token=token-value' },
        }),
      });

      await processAuthMiddleware(config);

      expect(checkSessionRequiredSpy).toHaveBeenCalledWith(
        '/dashboard',
        ['/api/auth', '/public'],
        LOGIN_URL,
        sessionData
      );
    });

    test('handles failed session response gracefully', async () => {
      const sessionResponse = new Response('Unauthorized', { status: 401 });

      vi.spyOn(proxyHandler, 'handleAuthProxyRequest').mockResolvedValue(sessionResponse);
      const checkSessionRequiredSpy = vi
        .spyOn(routeProtection, 'checkSessionRequired')
        .mockReturnValue({ allowed: false, requiresRedirect: true });

      const config = createTestConfig({
        request: new Request('https://app.com/dashboard', {
          headers: { Cookie: '__Secure-neon-auth.session_token=token-value' },
        }),
      });

      await processAuthMiddleware(config);

      // Should pass null session data on failed response
      expect(checkSessionRequiredSpy).toHaveBeenCalledWith(
        '/dashboard',
        ['/api/auth', '/public'],
        LOGIN_URL,
        { session: null, user: null }
      );
    });

    test('handles JSON parse errors gracefully', async () => {
      const sessionResponse = new Response('Invalid JSON', { status: 200 });

      vi.spyOn(proxyHandler, 'handleAuthProxyRequest').mockResolvedValue(sessionResponse);
      const checkSessionRequiredSpy = vi
        .spyOn(routeProtection, 'checkSessionRequired')
        .mockReturnValue({ allowed: false, requiresRedirect: true });

      const config = createTestConfig({
        request: new Request('https://app.com/dashboard', {
          headers: { Cookie: '__Secure-neon-auth.session_token=token-value' },
        }),
      });

      await processAuthMiddleware(config);

      // Should pass null session data on parse error
      expect(checkSessionRequiredSpy).toHaveBeenCalledWith(
        '/dashboard',
        ['/api/auth', '/public'],
        LOGIN_URL,
        { session: null, user: null }
      );
    });
  });

  describe('route protection', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('allows access when session is valid', async () => {
      const sessionData = { session: { id: 'session-123' }, user: { id: 'user-123' } };

      vi.spyOn(proxyHandler, 'handleAuthProxyRequest').mockResolvedValue(Response.json(sessionData));
      vi.spyOn(routeProtection, 'checkSessionRequired').mockReturnValue({
        allowed: true,
        requiresRedirect: false,
      });

      const config = createTestConfig({
        request: new Request('https://app.com/dashboard', {
          headers: { Cookie: '__Secure-neon-auth.session_token=token-value' },
        }),
      });

      const result = await processAuthMiddleware(config);

      expect(result.action).toBe('allow');
    });

    test('adds middleware header on allow', async () => {
      vi.spyOn(proxyHandler, 'handleAuthProxyRequest').mockResolvedValue(Response.json({}));
      const config = createTestConfig({
        request: new Request('https://app.com/dashboard', {
          headers: { Cookie: '__Secure-neon-auth.session_token=token-value' },
        }),
      });

      const result = await processAuthMiddleware(config);

      expect(result.action).toBe('allow');
      if (result.action === 'allow') {
        expect(result.headers).toEqual({ 'x-neon-auth-middleware': 'true' });
      }
    });

    test('redirects to login when session required but missing', async () => {
      const config = createTestConfig({
        request: new Request('https://app.com/dashboard'),
      });

      const result = await processAuthMiddleware(config);

      expect(result.action).toBe('redirect_login');
      if (result.action === 'redirect_login') {
        expect(result.redirectUrl.pathname).toBe(LOGIN_URL);
        expect(result.redirectUrl.origin).toBe('https://app.com');
      }
    });

    test('preserves request query parameters when redirecting to login', async () => {
      const config = createTestConfig({
        request: new Request(
          'https://app.com/dashboard?neon_auth_session_verifier=verifier&source=oauth&tag=a&tag=b'
        ),
      });

      const result = await processAuthMiddleware(config);

      expect(result.action).toBe('redirect_login');
      if (result.action === 'redirect_login') {
        expect(result.redirectUrl.pathname).toBe(LOGIN_URL);
        expect(result.redirectUrl.searchParams.get('neon_auth_session_verifier')).toBe('verifier');
        expect(result.redirectUrl.searchParams.get('source')).toBe('oauth');
        expect(result.redirectUrl.searchParams.getAll('tag')).toEqual(['a', 'b']);
      }
    });

    test('keeps configured login parameters and appends only non-colliding request parameters', async () => {
      const config = createTestConfig({
        loginUrl: '/auth/sign-in?source=configured&campaign=configured',
        request: new Request(
          'https://app.com/dashboard?tag=a&source=request&tag=b&next=%2Faccount'
        ),
      });

      const result = await processAuthMiddleware(config);

      expect(result.action).toBe('redirect_login');
      if (result.action === 'redirect_login') {
        expect([...result.redirectUrl.searchParams.entries()]).toEqual([
          ['source', 'configured'],
          ['campaign', 'configured'],
          ['tag', 'a'],
          ['tag', 'b'],
          ['next', '/account'],
        ]);
      }
    });

    test('does not copy request query parameters to an external login URL', async () => {
      const config = createTestConfig({
        loginUrl: 'https://identity.example.com/sign-in?source=configured',
        request: new Request(
          'https://app.com/dashboard?neon_auth_session_verifier=secret&source=request&tag=a'
        ),
      });

      const result = await processAuthMiddleware(config);

      expect(result.action).toBe('redirect_login');
      if (result.action === 'redirect_login') {
        expect(result.redirectUrl.href).toBe(
          'https://identity.example.com/sign-in?source=configured'
        );
      }
    });

    test('allows the generated login URL when loginUrl contains query parameters', async () => {
      const loginUrl = '/auth/sign-in?source=configured';
      const redirectResult = await processAuthMiddleware(
        createTestConfig({
          loginUrl,
          request: new Request('https://app.com/dashboard?source=request'),
        })
      );

      expect(redirectResult.action).toBe('redirect_login');
      if (redirectResult.action !== 'redirect_login') {
        return;
      }

      const loginRequest = new Request(redirectResult.redirectUrl);
      const result = await processAuthMiddleware(
        createTestConfig({
          loginUrl,
          request: loginRequest,
          pathname: new URL(loginRequest.url).pathname,
        })
      );

      expect(result.action).toBe('allow');
    });

    test('allows access to skip routes without session', async () => {
      const config = createTestConfig({
        request: new Request('https://app.com/public/page'),
        pathname: '/public/page',
      });

      const result = await processAuthMiddleware(config);

      expect(result.action).toBe('allow');
    });

    test('does not skip sibling paths that share a skip route prefix', async () => {
      const config = createTestConfig({
        skipRoutes: ['/auth'],
        request: new Request('https://app.com/auth-admin'),
        pathname: '/auth-admin',
      });

      const result = await processAuthMiddleware(config);

      expect(result.action).toBe('redirect_login');
    });

    test.each([
      ['/auth', '/auth'],
      ['/auth/', '/auth'],
      ['/auth/profile', '/auth'],
      ['/auth', '/auth/'],
      ['/auth/', '/auth/'],
      ['/auth/profile', '/auth/'],
      ['/', '/'],
    ])('allows pathname %s for skip route %s', async (pathname, skipRoute) => {
      const config = createTestConfig({
        skipRoutes: [skipRoute],
        request: new Request(`https://app.com${pathname}`),
        pathname,
      });

      const result = await processAuthMiddleware(config);

      expect(result.action).toBe('allow');
    });

    test('does not treat root skip route as matching every path', async () => {
      const config = createTestConfig({
        skipRoutes: ['/'],
        request: new Request('https://app.com/dashboard'),
        pathname: '/dashboard',
      });

      const result = await processAuthMiddleware(config);

      expect(result.action).toBe('redirect_login');
    });
  });
});

describe('processAuthMiddleware OAuth provider resume', () => {
  const SESSION_COOKIE = '__Secure-neon-auth.session_token=token-value';
  const SIG = 'sig-secret-value';
  const CONSENT_URL = 'https://app.com/consent?client_id=c1&scope=openid';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function signedSearch(extra: Array<[string, string]> = [], signed = ['ba_iat', 'client_id', 'scope', 'prompt', 'response_type', 'redirect_uri']) {
    const params = new URLSearchParams();
    for (const [k, v] of extra) params.append(k, v);
    params.append('ba_iat', '1700000000');
    params.append('sig', SIG);
    for (const name of [...new Set([...signed, 'ba_param'])].toSorted()) params.append('ba_param', name);
    return params.toString();
  }

  function baseSearch(extra: Array<[string, string]> = []) {
    return signedSearch([
      ['response_type', 'code'],
      ['client_id', 'c1'],
      ['scope', 'openid profile'],
      ['redirect_uri', 'https://rp.example/cb'],
      ...extra,
    ]);
  }

  function loginRequest(search: string, init: { method?: string; cookie?: string | null; headers?: Record<string, string>; path?: string } = {}) {
    const headers: Record<string, string> = { ...init.headers };
    const cookie = init.cookie === undefined ? SESSION_COOKIE : init.cookie;
    if (cookie) headers.Cookie = cookie;
    const path = init.path ?? '/auth/sign-in';
    return new Request(`https://app.com${path}?${search}`, { method: init.method ?? 'GET', headers });
  }

  function run(request: Request, overrides?: Partial<AuthMiddlewareConfig>) {
    return processAuthMiddleware(
      createTestConfig({ request, pathname: new URL(request.url).pathname, ...overrides })
    );
  }

  function mockContinue(response: Response) {
    return vi.spyOn(proxyHandler, 'handleAuthProxyRequest').mockImplementation(async () => response);
  }

  function continueResponse(url: string, cookies: string[] = ['a=1; Path=/']) {
    const res = Response.json({ redirect: true, url });
    for (const c of cookies) res.headers.append('Set-Cookie', c);
    return res;
  }

  test('resumes a signed request for a signed-in user', async () => {
    const spy = mockContinue(continueResponse(CONSENT_URL, ['a=1; Path=/', 'b=2; Path=/']));
    const search = baseSearch();

    const result = await run(
      loginRequest(search, { headers: { Referer: 'https://rp.example/start' } })
    );

    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0][0];
    expect(arg.path).toBe('oauth2/continue');
    expect(arg.request.method).toBe('POST');
    expect(arg.request.url).toBe('https://app.com/auth/sign-in');
    expect(arg.request.headers.get('origin')).toBe('https://app.com');
    expect(arg.request.headers.get('content-type')).toBe('application/json');
    expect(arg.request.headers.get('cookie')).toContain(SESSION_COOKIE);
    expect(arg.request.headers.has('x-neon-client-info')).toBe(true);
    expect(await arg.request.json()).toEqual({
      selected: true,
      oauth_query: new URLSearchParams(search).toString(),
    });
    expect(result).toEqual({
      action: 'redirect_oauth',
      redirectUrl: new URL(CONSENT_URL),
      cookies: ['a=1; Path=/', 'b=2; Path=/'],
    });
  });

  test('keeps only signed parameters in oauth_query', async () => {
    const spy = mockContinue(continueResponse(CONSENT_URL));
    const search = baseSearch([['utm_source', 'x']]);

    await run(loginRequest(search));

    const body = await spy.mock.calls[0][0].request.json();
    const sent = new URLSearchParams(body.oauth_query);
    expect(sent.has('utm_source')).toBe(false);
    expect(sent.get('sig')).toBe(SIG);
    expect(sent.get('client_id')).toBe('c1');
  });

  test.each([
    ['401', () => Response.json({ message: 'no session' }, { status: 401 })],
    ['400', () => Response.json({ message: 'bad' }, { status: 400 })],
    ['502 transport', () => Response.json({ error: 'x', code: 'ECONNREFUSED' }, { status: 502 })],
    ['non-JSON 200', () => new Response('<html>', { status: 200 })],
    ['malformed url', () => Response.json({ redirect: true, url: 'not a url' })],
    ['relative url', () => Response.json({ redirect: true, url: '/consent?x=1' })],
    ['redirect false', () => Response.json({ redirect: false, url: CONSENT_URL })],
    ['url not a string', () => Response.json({ redirect: true, url: 5 })],
    ['login page again', () => Response.json({ redirect: true, url: 'https://app.com/auth/sign-in?foo=bar' })],
  ])('falls back to allow on %s and forwards cookies', async (_name, make) => {
    const res = make();
    res.headers.append('Set-Cookie', 'c=3; Path=/');
    mockContinue(res);

    const result = await run(loginRequest(baseSearch()));

    expect(result).toEqual({ action: 'allow', cookies: ['c=3; Path=/'] });
  });

  test('does not call upstream without a session cookie', async () => {
    const spy = mockContinue(continueResponse(CONSENT_URL));
    const result = await run(loginRequest(baseSearch(), { cookie: null }));
    expect(spy).not.toHaveBeenCalled();
    expect(result.action).toBe('allow');
  });

  test.each(['login', 'create', 'select_account', 'consent login'])(
    'does not resume for signed prompt=%s',
    async (prompt) => {
      const spy = mockContinue(continueResponse(CONSENT_URL));
      const result = await run(loginRequest(baseSearch([['prompt', prompt]])));
      expect(spy).not.toHaveBeenCalled();
      expect(result.action).toBe('allow');
    }
  );

  test('resumes for signed prompt=consent', async () => {
    const spy = mockContinue(continueResponse(CONSENT_URL));
    await run(loginRequest(baseSearch([['prompt', 'consent']])));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test('ignores an unsigned prompt=login', async () => {
    const spy = mockContinue(continueResponse(CONSENT_URL));
    const search = signedSearch(
      [
        ['client_id', 'c1'],
        ['prompt', 'login'],
      ],
      ['client_id']
    );
    await run(loginRequest(search));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['no sig', 'client_id=c1&ba_param=client_id&ba_param=ba_param'],
    ['no ba_param', `client_id=c1&sig=${SIG}`],
    ['no query', ''],
  ])('does not resume with %s', async (_name, search) => {
    const spy = mockContinue(continueResponse(CONSENT_URL));
    const result = await run(loginRequest(search));
    expect(spy).not.toHaveBeenCalled();
    expect(result).toEqual({ action: 'allow' });
  });

  test('does not resume for a POST (Server Action)', async () => {
    const spy = mockContinue(continueResponse(CONSENT_URL));
    await run(loginRequest(baseSearch(), { method: 'POST' }));
    expect(spy).not.toHaveBeenCalled();
  });

  test('does not resume on a subpath of the login path', async () => {
    const spy = mockContinue(continueResponse(CONSENT_URL));
    await run(loginRequest(baseSearch(), { path: '/auth/sign-in/email' }));
    expect(spy).not.toHaveBeenCalled();
  });

  test('resumes when the login path has a trailing slash', async () => {
    const spy = mockContinue(continueResponse(CONSENT_URL));
    await run(loginRequest(baseSearch(), { path: '/auth/sign-in/' }));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test('does not resume for an external loginUrl', async () => {
    const spy = mockContinue(continueResponse(CONSENT_URL));
    await run(loginRequest(baseSearch()), { loginUrl: 'https://identity.example.com/auth/sign-in' });
    expect(spy.mock.calls.map(([arg]) => arg.path)).not.toContain('oauth2/continue');
  });

  test('exchanges a session verifier first and keeps sig for the next request', async () => {
    const spy = mockContinue(continueResponse(CONSENT_URL));
    const exchange = vi.spyOn(oauth, 'exchangeOAuthToken').mockImplementation(async (request) => {
      const url = new URL(request.url);
      url.searchParams.delete('neon_auth_session_verifier');
      return { redirectUrl: url, cookies: ['session=1; Path=/'], success: true };
    });
    const search = `${baseSearch()}&neon_auth_session_verifier=v1`;

    const result = await run(
      loginRequest(search, {
        cookie: `${SESSION_COOKIE}; __Secure-neon-auth.session_challange=ch`,
      })
    );

    expect(exchange).toHaveBeenCalledTimes(1);
    expect(spy).not.toHaveBeenCalled();
    expect(result.action).toBe('redirect_oauth');
    if (result.action === 'redirect_oauth') {
      expect(result.redirectUrl.searchParams.has('neon_auth_session_verifier')).toBe(false);
      expect(result.redirectUrl.searchParams.get('sig')).toBe(SIG);
      expect(result.cookies).toEqual(['session=1; Path=/']);
    }
  });

  test('falls through to resume when the verifier exchange fails', async () => {
    const spy = mockContinue(continueResponse(CONSENT_URL));
    vi.spyOn(oauth, 'exchangeOAuthToken').mockResolvedValue(null);
    const search = `${baseSearch()}&neon_auth_session_verifier=v1`;

    await run(
      loginRequest(search, {
        cookie: `${SESSION_COOKIE}; __Secure-neon-auth.session_challange=ch`,
      })
    );

    expect(spy).toHaveBeenCalledTimes(1);
  });

  test('never takes the redirect target from the request', async () => {
    mockContinue(continueResponse(CONSENT_URL));
    const search = baseSearch([
      ['url', 'https://evil.example/steal'],
      ['redirect', 'https://evil.example/x'],
    ]);

    const result = await run(loginRequest(search));

    expect(result.action).toBe('redirect_oauth');
    if (result.action === 'redirect_oauth') {
      expect(result.redirectUrl.href).toBe(CONSENT_URL);
    }
  });

  test('allows custom-scheme redirect targets returned by upstream', async () => {
    mockContinue(continueResponse('cursor://oauth/cb?code=abc'));
    const result = await run(loginRequest(baseSearch()));
    expect(result.action).toBe('redirect_oauth');
  });

  test('never logs the target URL, oauth_query, sig or code', async () => {
    mockContinue(continueResponse('https://rp.example/cb?code=SECRETCODE&state=s'));
    const log: ResolvedNeonAuthLogging = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    };

    await run(loginRequest(baseSearch()), { log });
    mockContinue(Response.json({ message: 'no' }, { status: 401 }));
    await run(loginRequest(baseSearch()), { log });

    const logged = JSON.stringify(
      Object.values(log).flatMap((fn) => (fn as ReturnType<typeof vi.fn>).mock.calls)
    );
    expect(logged).not.toContain('code=');
    expect(logged).not.toContain('SECRETCODE');
    expect(logged).not.toContain(SIG);
    expect(logged).not.toContain('oauth_query');
    expect(log.debug).toHaveBeenCalled();
  });
});

describe('processAuthMiddleware client-info header', () => {
  const originalNextRuntime = process.env.NEXT_RUNTIME;

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    if (originalNextRuntime === undefined) delete process.env.NEXT_RUNTIME;
    else process.env.NEXT_RUNTIME = originalNextRuntime;
  });

  // The injector caches client info at module init, so the env must be set
  // before the module graph is (re)loaded.
  async function captureSessionLookup(headers: Record<string, string>) {
    process.env.NEXT_RUNTIME = 'nodejs';
    vi.resetModules();
    const handler = await import('../proxy/handler');
    const { processAuthMiddleware: run } = await import('./processor');
    const { BETTER_AUTH_VERSION } = await import('../../utils/better-auth-version');
    const spy = vi
      .spyOn(handler, 'handleAuthProxyRequest')
      .mockResolvedValue(Response.json({ session: null, user: null }));

    await run(
      createTestConfig({
        request: new Request('https://app.com/dashboard', {
          method: 'POST',
          headers: {
            Cookie: '__Secure-neon-auth.session_token=token-value',
            'Content-Type': 'application/x-www-form-urlencoded',
            ...headers,
          },
          body: 'a=b',
        }),
      }),
    );

    const sessionRequest = spy.mock.calls[0][0].request;
    return { sessionRequest, BETTER_AUTH_VERSION };
  }

  test('stamps X-Neon-Client-Info on the get-session lookup', async () => {
    const { sessionRequest, BETTER_AUTH_VERSION } = await captureSessionLookup({});

    const info = JSON.parse(sessionRequest.headers.get('X-Neon-Client-Info')!);
    expect(info.sdk).toBe('@neondatabase/auth');
    expect(info.framework).toBe('next');
    expect(info.betterAuthVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(info.betterAuthVersion).toBe(BETTER_AUTH_VERSION);
    const [major, minor] = info.betterAuthVersion.split('.').map(Number);
    expect(major > 1 || (major === 1 && minor >= 7)).toBe(true);
    expect(sessionRequest.headers.has('content-type')).toBe(false);
  });

  test('preserves an inbound X-Neon-Client-Info value', async () => {
    const inbound = JSON.stringify({ sdk: 'custom', version: '9.9.9' });
    const { sessionRequest } = await captureSessionLookup({ 'X-Neon-Client-Info': inbound });

    expect(sessionRequest.headers.get('X-Neon-Client-Info')).toBe(inbound);
  });
});
