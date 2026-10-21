import {
  describe,
  test,
  expect,
  expectTypeOf,
  vi,
  beforeEach,
  afterEach,
} from 'vitest';
import { createAuthClient } from './neon-auth';
import { BetterAuthVanillaAdapter } from './adapters/better-auth-vanilla/better-auth-vanilla-adapter';
import { BetterAuthReactAdapter } from './adapters/better-auth-react/better-auth-react-adapter';
import { BETTER_AUTH_METHODS_CACHE } from './core/better-auth-methods';
import type { OAuth2ResumeResult } from './core/oauth2-resume';

describe('oauth2 client types', () => {
  test('the default client exposes oauth2', () => {
    const auth = createAuthClient('https://auth.example.com');
    expectTypeOf(auth).toHaveProperty('oauth2');
    expectTypeOf(auth.oauth2).toHaveProperty('consent');
    expectTypeOf(auth.oauth2).toHaveProperty('publicClient');
  });
});

describe('oauth2 client runtime', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () =>
      Response.json({ redirect_uri: 'https://rp.example.com/cb' })
    );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllGlobals();
    BETTER_AUTH_METHODS_CACHE.clearSessionCache();
  });

  const lastCall = () => {
    const [url, init] = fetchMock.mock.calls.at(-1) as [unknown, RequestInit];
    return { url: String(url), init };
  };

  test('the oauth-provider client plugin is configured by default', () => {
    const adapter = BetterAuthVanillaAdapter()(
      'https://auth.example.com'
    ) as any;
    const ids = adapter.betterAuthOptions.plugins.map(
      (plugin: { id: string }) => plugin.id
    );
    expect(ids).toContain('oauth-provider-client');
  });

  test('consent POSTs to /oauth2/consent', async () => {
    const auth = createAuthClient('https://auth.example.com');
    await auth.oauth2.consent({ accept: true });
    const { url, init } = lastCall();
    expect(url).toBe('https://auth.example.com/api/auth/oauth2/consent');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toMatchObject({ accept: true });
  });

  const SIGNED_SEARCH =
    '?client_id=abc&scope=openid%20profile&exp=4102444800&utm=1&sig=s1' +
    '&ba_param=client_id&ba_param=scope&ba_param=exp&ba_param=ba_param';
  // Mirrors the plugin's buildSignedOAuthQuery: signed names plus `sig`, in
  // URL order, with unsigned params (utm) dropped.
  const EXPECTED_OAUTH_QUERY =
    'client_id=abc&scope=openid+profile&exp=4102444800&sig=s1' +
    '&ba_param=client_id&ba_param=scope&ba_param=exp&ba_param=ba_param';

  test('consent carries the signed query of the page as oauth_query', async () => {
    vi.stubGlobal('window', { location: { search: SIGNED_SEARCH } });
    const auth = createAuthClient('https://auth.example.com');
    await auth.oauth2.consent({ accept: true });
    const body = JSON.parse(lastCall().init.body as string);
    expect(body.oauth_query).toBe(EXPECTED_OAUTH_QUERY);
  });

  test('sign-in carries the signed query of the page as oauth_query', async () => {
    vi.stubGlobal('window', { location: { search: SIGNED_SEARCH } });
    const auth = createAuthClient('https://auth.example.com');
    await auth.signIn.email({ email: 'a@b.com', password: 'secret-password' });
    const { url, init } = lastCall();
    expect(url).toBe('https://auth.example.com/api/auth/sign-in/email');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ email: 'a@b.com' });
    expect(body.oauth_query).toBe(EXPECTED_OAUTH_QUERY);
  });

  test('sign-in without a signed query carries no oauth_query', async () => {
    vi.stubGlobal('window', { location: { search: '?utm=1' } });
    const auth = createAuthClient('https://auth.example.com');
    await auth.signIn.email({ email: 'a@b.com', password: 'secret-password' });
    const { url, init } = lastCall();
    expect(url).toBe('https://auth.example.com/api/auth/sign-in/email');
    const body = JSON.parse(init.body as string);
    expect(body).not.toHaveProperty('oauth_query');
    expect(body).toMatchObject({ email: 'a@b.com' });
  });

  test('publicClient GETs /oauth2/public-client with client_id', async () => {
    const auth = createAuthClient('https://auth.example.com');
    await auth.oauth2.publicClient({ query: { client_id: 'abc' } });
    const { url, init } = lastCall();
    expect(url).toBe(
      'https://auth.example.com/api/auth/oauth2/public-client?client_id=abc'
    );
    expect(init.method).toBe('GET');
  });

  test('a cached session does not short-circuit /oauth2/token', async () => {
    const now = new Date();
    BETTER_AUTH_METHODS_CACHE.setCachedSession({
      session: {
        id: 's1',
        userId: 'u1',
        token: 'tok',
        expiresAt: new Date(Date.now() + 3_600_000),
        createdAt: now,
        updatedAt: now,
      },
      user: {
        id: 'u1',
        email: 'a@b.com',
        name: 'A',
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    } as never);
    expect(BETTER_AUTH_METHODS_CACHE.getCachedSession()).not.toBeNull();

    const auth = createAuthClient('https://auth.example.com');
    const result = await (auth as any).$fetch('/oauth2/token', {
      method: 'POST',
      body: { grant_type: 'authorization_code' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(lastCall().url).toBe(
      'https://auth.example.com/api/auth/oauth2/token'
    );
    expect(result.data).toEqual({ redirect_uri: 'https://rp.example.com/cb' });
  });

  test('a database named oauth2 still serves getSession from the cache', async () => {
    const now = new Date();
    const cached = {
      session: {
        id: 's1',
        userId: 'u1',
        token: 'tok',
        expiresAt: new Date(Date.now() + 3_600_000),
        createdAt: now,
        updatedAt: now,
      },
      user: {
        id: 'u1',
        email: 'a@b.com',
        name: 'A',
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    };
    BETTER_AUTH_METHODS_CACHE.setCachedSession(cached as never);

    const auth = createAuthClient('https://ep.example.com/oauth2/auth');
    const result = await auth.getSession();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.data?.user.id).toBe('u1');
  });
});

describe('oauth2.resume', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;
  let respond: () => Response;

  const SIGNED_SEARCH =
    '?client_id=abc&scope=openid&exp=4102444800&utm=1&sig=s1' +
    '&ba_param=client_id&ba_param=scope&ba_param=exp&ba_param=sig&ba_param=ba_param';
  const EXPECTED_OAUTH_QUERY =
    'client_id=abc&scope=openid&exp=4102444800&sig=s1' +
    '&ba_param=client_id&ba_param=scope&ba_param=exp&ba_param=sig&ba_param=ba_param';

  beforeEach(() => {
    respond = () =>
      Response.json({ redirect: true, url: 'https://app.example.com/consent?x=1' });
    fetchMock = vi.fn(async () => respond());
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllGlobals();
    BETTER_AUTH_METHODS_CACHE.clearSessionCache();
  });

  const stubSearch = (search: string) => {
    const location = { search, href: 'https://app.example.com/sign-in' };
    vi.stubGlobal('window', { location });
    return location;
  };

  test('is typed on the vanilla and react clients', () => {
    const vanilla = createAuthClient('https://auth.example.com');
    expectTypeOf(vanilla.oauth2.resume).returns.resolves.toEqualTypeOf<OAuth2ResumeResult>();
    expectTypeOf(vanilla.oauth2).toHaveProperty('consent');
    const react = createAuthClient('https://auth.example.com', {
      adapter: BetterAuthReactAdapter(),
    });
    expectTypeOf(react.oauth2.resume).returns.resolves.toEqualTypeOf<OAuth2ResumeResult>();
    expectTypeOf(react.oauth2).toHaveProperty('consent');
  });

  test('continues with the signed query and reports the redirect', async () => {
    stubSearch(SIGNED_SEARCH);
    const auth = createAuthClient('https://auth.example.com');
    const result = await auth.oauth2.resume();
    expect(result).toEqual({
      status: 'redirect',
      url: 'https://app.example.com/consent?x=1',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [unknown, RequestInit];
    expect(String(url)).toBe('https://auth.example.com/api/auth/oauth2/continue');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      selected: true,
      oauth_query: EXPECTED_OAUTH_QUERY,
    });
  });

  test('the default redirect plugin navigates the browser', async () => {
    const location = stubSearch(SIGNED_SEARCH);
    const auth = createAuthClient('https://auth.example.com');
    await auth.oauth2.resume();
    expect(location.href).toBe('https://app.example.com/consent?x=1');
  });

  test('works on the react client', async () => {
    stubSearch(SIGNED_SEARCH);
    const auth = createAuthClient('https://auth.example.com', {
      adapter: BetterAuthReactAdapter(),
    });
    const result = await auth.oauth2.resume();
    expect(result.status).toBe('redirect');
  });

  test('401 is no_session', async () => {
    respond = () =>
      Response.json({ code: 'UNAUTHORIZED' }, { status: 401, statusText: 'Unauthorized' });
    stubSearch(SIGNED_SEARCH);
    const auth = createAuthClient('https://auth.example.com');
    expect(await auth.oauth2.resume()).toEqual({ status: 'no_session' });
  });

  test('400 invalid_signature is expired', async () => {
    respond = () =>
      Response.json({ error: 'invalid_signature' }, { status: 400, statusText: 'Bad Request' });
    stubSearch(SIGNED_SEARCH);
    const auth = createAuthClient('https://auth.example.com');
    expect(await auth.oauth2.resume()).toEqual({ status: 'expired' });
  });

  test('404 is not_oauth', async () => {
    respond = () => new Response('', { status: 404, statusText: 'Not Found' });
    stubSearch(SIGNED_SEARCH);
    const auth = createAuthClient('https://auth.example.com');
    expect(await auth.oauth2.resume()).toEqual({ status: 'not_oauth' });
  });

  test('other failures are reported as error', async () => {
    respond = () =>
      Response.json({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    stubSearch(SIGNED_SEARCH);
    const auth = createAuthClient('https://auth.example.com');
    const result = await auth.oauth2.resume();
    expect(result).toMatchObject({ status: 'error', error: { status: 500 } });
  });

  test.each(['login', 'create'])(
    'prompt=%s is login_required and makes no request',
    async (prompt) => {
      stubSearch(
        `${SIGNED_SEARCH}&prompt=${prompt}&ba_param=prompt`
      );
      const auth = createAuthClient('https://auth.example.com');
      expect(await auth.oauth2.resume()).toEqual({ status: 'login_required' });
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  test('a page without a signed query is not_oauth and makes no request', async () => {
    stubSearch('?utm=1');
    const auth = createAuthClient('https://auth.example.com');
    expect(await auth.oauth2.resume()).toEqual({ status: 'not_oauth' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('without a window it is not_oauth and makes no request', async () => {
    const auth = createAuthClient('https://auth.example.com');
    expect(await auth.oauth2.resume()).toEqual({ status: 'not_oauth' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('accepts no arguments', () => {
    const auth = createAuthClient('https://auth.example.com');
    expectTypeOf(auth.oauth2.resume).parameters.toEqualTypeOf<[]>();
  });
});
