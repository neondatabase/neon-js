import { afterEach, describe, expect, test, vi } from 'vitest';
import { neonExpoClient } from './expo-client';

type FetchPlugin =
  NonNullable<ReturnType<typeof neonExpoClient>['fetchPlugins']>[number];
type OnSuccess = NonNullable<
  NonNullable<FetchPlugin['hooks']>['onSuccess']
>;

function createStorage() {
  const values = new Map<string, string>();
  return {
    values,
    deleteItemAsync: vi.fn(async (key: string) => {
      values.delete(key);
    }),
    getItemAsync: vi.fn(async (key: string) => values.get(key) ?? null),
    setItemAsync: vi.fn(async (key: string, value: string) => {
      values.set(key, value);
    })
  };
}

function createNativeClient(result: {
  type: string;
  url?: string;
}) {
  vi.stubGlobal('navigator', { product: 'ReactNative' });
  const storage = createStorage();
  const browser = {
    openAuthSessionAsync: vi.fn(async () => result)
  };
  const plugin = neonExpoClient({
    scheme: 'myapp:',
    storageKey: 'neon-auth_cookie',
    storage,
    browser
  });
  const clientFetch = vi.fn(async (_url: string, _options?: unknown) => ({
    data: {},
    error: null
  }));
  const clientStore = {
    notify: vi.fn(),
    listen: vi.fn(),
    atoms: {}
  };
  plugin.getActions?.(
    clientFetch as unknown as Parameters<
      NonNullable<typeof plugin.getActions>
    >[0],
    clientStore as unknown as Parameters<
      NonNullable<typeof plugin.getActions>
    >[1],
    {}
  );

  return {
    browser,
    clientFetch,
    clientStore,
    fetchPlugin: plugin.fetchPlugins?.[0],
    storage
  };
}

async function runSuccess(
  fetchPlugin: FetchPlugin,
  {
    body = '{}',
    data = {},
    requestURL = 'https://auth.example.com/neondb/auth/get-session',
    setCookie
  }: {
    body?: string;
    data?: unknown;
    requestURL?: string;
    setCookie?: string;
  }
) {
  await fetchPlugin.hooks?.onSuccess?.({
    data,
    request: {
      url: new URL(requestURL),
      baseURL: 'https://auth.example.com/neondb/auth',
      body
    },
    response: new Response(null, {
      headers: setCookie ? { 'set-cookie': setCookie } : {}
    })
  } as Parameters<OnSuccess>[0]);
}

describe('neonExpoClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('leaves web requests unchanged', async () => {
    vi.stubGlobal('navigator', { product: 'Gecko' });
    const storage = createStorage();
    const browser = { openAuthSessionAsync: vi.fn() };
    const plugin = neonExpoClient({
      scheme: 'myapp',
      storageKey: 'neon-auth_cookie',
      storage,
      browser
    });
    const fetchPlugin = plugin.fetchPlugins?.[0];
    const requestOptions = { method: 'POST' as const };

    const result = await fetchPlugin?.init?.(
      'https://auth.example.com/sign-in/email',
      requestOptions
    );

    expect(result).toEqual({
      url: 'https://auth.example.com/sign-in/email',
      options: requestOptions
    });
    expect(storage.getItemAsync).not.toHaveBeenCalled();
    expect(browser.openAuthSessionAsync).not.toHaveBeenCalled();
  });

  test('persists the challenge cookie and exchanges the OAuth verifier', async () => {
    const { browser, clientFetch, fetchPlugin, storage } = createNativeClient({
      type: 'success',
      url: 'myapp://auth/callback?neon_auth_session_verifier=verifier-123'
    });
    const initialized = await fetchPlugin?.init?.(
      'https://auth.example.com/neondb/auth/sign-in/social',
      {
        method: 'POST',
        body: {
          provider: 'google',
          callbackURL: '/auth/callback'
        }
      }
    );

    expect(initialized).toBeDefined();
    if (!fetchPlugin || !initialized?.options) {
      throw new Error('Expected initialized plugin');
    }

    expect(initialized.options.body).toMatchObject({
      callbackURL: 'myapp://auth/callback',
      disableRedirect: true
    });
    expect(initialized.options).toMatchObject({
      credentials: 'omit',
      headers: {
        origin: 'myapp://',
        referer: 'myapp://'
      }
    });

    await runSuccess(fetchPlugin, {
      data: {
        redirect: true,
        url: 'https://accounts.example.com/oauth'
      },
      requestURL: 'https://auth.example.com/neondb/auth/sign-in/social',
      body: JSON.stringify(initialized.options.body),
      setCookie:
        '__Secure-neon-auth.session_challenge=challenge; Path=/; Secure; HttpOnly'
    });

    expect(browser.openAuthSessionAsync).toHaveBeenCalledWith(
      'https://accounts.example.com/oauth',
      'myapp://auth/callback'
    );
    const [sessionURL, sessionOptions] = clientFetch.mock.calls[0]!;
    expect(sessionURL).toBe('/get-session');
    expect(sessionOptions).toMatchObject({
      method: 'GET',
      query: { neon_auth_session_verifier: 'verifier-123' },
      headers: { 'X-Force-Fetch': '1' }
    });

    const cookies = JSON.parse(
      storage.values.get('neon-auth_cookie') ?? '{}'
    ) as Record<string, { value: string }>;
    expect(cookies['__Secure-neon-auth.session_challenge']?.value).toBe(
      'challenge'
    );

    const sessionRequest = await fetchPlugin?.init?.(
      'https://auth.example.com/get-session',
      { method: 'GET' }
    );
    expect(sessionRequest).toBeDefined();
    if (!sessionRequest?.options) {
      throw new Error('Expected session fetch options');
    }
    expect(sessionRequest.options.headers).toMatchObject({
      cookie: '__Secure-neon-auth.session_challenge=challenge'
    });
  });

  test('keeps web success handling unchanged', async () => {
    vi.stubGlobal('navigator', { product: 'Gecko' });
    const storage = createStorage();
    const browser = { openAuthSessionAsync: vi.fn() };
    const plugin = neonExpoClient({
      scheme: 'myapp',
      storageKey: 'neon-auth_cookie',
      storage,
      browser
    });
    const fetchPlugin = plugin.fetchPlugins?.[0];
    if (!fetchPlugin) {
      throw new Error('Expected fetch plugin');
    }

    await runSuccess(fetchPlugin, {
      data: {
        redirect: true,
        url: 'https://accounts.example.com/oauth'
      },
      requestURL: 'https://auth.example.com/neondb/auth/sign-in/social',
      setCookie: '__Secure-neon-auth.session_token=token'
    });

    expect(storage.setItemAsync).not.toHaveBeenCalled();
    expect(browser.openAuthSessionAsync).not.toHaveBeenCalled();
  });

  test('encodes, expires, and deletes stored cookies', async () => {
    const { clientStore, fetchPlugin } = createNativeClient({
      type: 'cancel'
    });
    if (!fetchPlugin) {
      throw new Error('Expected fetch plugin');
    }

    await runSuccess(fetchPlugin, {
      setCookie:
        '__Secure-neon-auth.session_token=hello%20world; Expires=invalid, __Secure-neon-auth.session_challenge=challenge; Expires=Wed, 21 Oct 2030 07:28:00 GMT'
    });

    const request = await fetchPlugin.init?.(
      'https://auth.example.com/neondb/auth/get-session',
      { method: 'GET' }
    );
    if (!request?.options) {
      throw new Error('Expected session fetch options');
    }
    expect(request.options.headers).toMatchObject({
      cookie:
        '__Secure-neon-auth.session_token=hello%20world; __Secure-neon-auth.session_challenge=challenge'
    });
    expect(clientStore.notify).toHaveBeenCalledOnce();
    expect(clientStore.notify).toHaveBeenLastCalledWith('$sessionSignal');

    await runSuccess(fetchPlugin, {
      setCookie:
        '__Secure-neon-auth.session_token=; Max-Age=0; Path=/; Secure'
    });
    const requestAfterDeletion = await fetchPlugin.init?.(
      'https://auth.example.com/neondb/auth/get-session',
      { method: 'GET' }
    );
    if (!requestAfterDeletion?.options) {
      throw new Error('Expected session fetch options');
    }
    const headersAfterDeletion = requestAfterDeletion.options
      .headers as Record<string, string>;
    expect(headersAfterDeletion.cookie ?? '').not.toContain('session_token');
    expect(clientStore.notify).toHaveBeenCalledTimes(2);
    expect(clientStore.notify).toHaveBeenLastCalledWith('$sessionSignal');

    await runSuccess(fetchPlugin, {
      setCookie:
        '__Secure-neon-auth.session_token=expired; Expires=Wed, 21 Oct 2015 07:28:00 GMT'
    });
    const requestAfterExpiry = await fetchPlugin.init?.(
      'https://auth.example.com/neondb/auth/get-session',
      { method: 'GET' }
    );
    if (!requestAfterExpiry?.options) {
      throw new Error('Expected session fetch options');
    }
    const headersAfterExpiry = requestAfterExpiry.options
      .headers as Record<string, string>;
    expect(headersAfterExpiry.cookie ?? '').not.toContain('session_token');
  });

  test('chunks cookies that exceed SecureStore limits', async () => {
    const { fetchPlugin, storage } = createNativeClient({ type: 'cancel' });
    if (!fetchPlugin) {
      throw new Error('Expected fetch plugin');
    }
    const token = 'a'.repeat(2000);

    await runSuccess(fetchPlugin, {
      setCookie: `__Secure-neon-auth.session_token=${token}; Path=/; Secure`
    });

    expect(storage.values.get('neon-auth_cookie')).toMatch(/^chunks:/);
    const chunkKeys = [...storage.values.keys()].filter((key) =>
      key.startsWith('neon-auth_cookie.')
    );
    expect(chunkKeys.length).toBeGreaterThan(0);
    const request = await fetchPlugin.init?.(
      'https://auth.example.com/neondb/auth/get-session',
      { method: 'GET' }
    );
    if (!request?.options) {
      throw new Error('Expected session fetch options');
    }
    expect(request.options.headers).toMatchObject({
      cookie: `__Secure-neon-auth.session_token=${token}`
    });

    await runSuccess(fetchPlugin, {
      setCookie: '__Secure-neon-auth.session_token=; Max-Age=0'
    });
    expect(chunkKeys.every((key) => !storage.values.has(key))).toBe(true);
  });

  test('serializes concurrent cookie updates', async () => {
    const { fetchPlugin } = createNativeClient({ type: 'cancel' });
    if (!fetchPlugin) {
      throw new Error('Expected fetch plugin');
    }

    await Promise.all([
      runSuccess(fetchPlugin, {
        setCookie: '__Secure-neon-auth.session_challenge=challenge'
      }),
      runSuccess(fetchPlugin, {
        setCookie: '__Secure-neon-auth.session_token=token'
      })
    ]);

    const request = await fetchPlugin.init?.(
      'https://auth.example.com/neondb/auth/get-session',
      { method: 'GET' }
    );
    if (!request?.options) {
      throw new Error('Expected session fetch options');
    }
    expect(request.options.headers).toMatchObject({
      cookie:
        '__Secure-neon-auth.session_challenge=challenge; __Secure-neon-auth.session_token=token'
    });
  });

  test('preserves absolute callback URLs', async () => {
    const { browser, clientFetch, fetchPlugin } = createNativeClient({
      type: 'success',
      url: 'https://app.example.com/auth/callback?neon_auth_session_verifier=verifier'
    });
    const result = await fetchPlugin?.init?.(
      'https://auth.example.com/neondb/auth/sign-in/social',
      {
        method: 'POST',
        body: {
          provider: 'google',
          callbackURL: 'https://app.example.com/auth/callback'
        }
      }
    );

    if (!result?.options) {
      throw new Error('Expected initialized fetch options');
    }
    expect(result.options.body).toMatchObject({
      callbackURL: 'https://app.example.com/auth/callback'
    });
    expect(result.options.headers).toMatchObject({
      origin: 'https://app.example.com',
      referer: 'https://app.example.com'
    });

    if (!fetchPlugin) {
      throw new Error('Expected fetch plugin');
    }
    await runSuccess(fetchPlugin, {
      body: JSON.stringify(result.options.body),
      data: {
        redirect: true,
        url: 'https://accounts.example.com/oauth'
      },
      requestURL: 'https://auth.example.com/neondb/auth/sign-in/social'
    });
    expect(browser.openAuthSessionAsync).toHaveBeenCalledWith(
      'https://accounts.example.com/oauth',
      'https://app.example.com/auth/callback',
      { preferUniversalLinks: true }
    );
    expect(clientFetch.mock.calls[0]?.[1]).toMatchObject({
      headers: {
        'X-Neon-Expo-Origin': 'https://app.example.com'
      }
    });
    const sessionOptions = clientFetch.mock.calls[0]?.[1];
    const sessionRequest = await fetchPlugin.init?.(
      'https://auth.example.com/neondb/auth/get-session',
      sessionOptions as Parameters<NonNullable<typeof fetchPlugin.init>>[1]
    );
    if (!sessionRequest?.options) {
      throw new Error('Expected session fetch options');
    }
    expect(sessionRequest.options.headers).toMatchObject({
      origin: 'https://app.example.com',
      referer: 'https://app.example.com'
    });
    expect(sessionRequest.options.headers).not.toHaveProperty(
      'X-Neon-Expo-Origin'
    );
  });

  test('handles browser cancellation without exchanging a verifier', async () => {
    const { clientFetch, fetchPlugin } = createNativeClient({ type: 'cancel' });
    if (!fetchPlugin) {
      throw new Error('Expected fetch plugin');
    }

    await expect(
      runSuccess(fetchPlugin, {
        body: JSON.stringify({ callbackURL: 'myapp://auth/callback' }),
        data: {
          redirect: true,
          url: 'https://accounts.example.com/oauth'
        },
        requestURL: 'https://auth.example.com/neondb/auth/sign-in/social'
      })
    ).resolves.toBeUndefined();
    expect(clientFetch).not.toHaveBeenCalled();
  });

  test('surfaces OAuth callback errors', async () => {
    const { fetchPlugin } = createNativeClient({
      type: 'success',
      url: 'myapp://auth/callback?error=access_denied&error_description=User%20denied%20access'
    });
    if (!fetchPlugin) {
      throw new Error('Expected fetch plugin');
    }

    await expect(
      runSuccess(fetchPlugin, {
        body: JSON.stringify({ callbackURL: 'myapp://auth/callback' }),
        data: {
          redirect: true,
          url: 'https://accounts.example.com/oauth'
        },
        requestURL: 'https://auth.example.com/neondb/auth/sign-in/social'
      })
    ).rejects.toThrow('User denied access');
  });

  test('rejects callbacks without a session verifier', async () => {
    const { fetchPlugin } = createNativeClient({
      type: 'success',
      url: 'myapp://auth/callback'
    });
    if (!fetchPlugin) {
      throw new Error('Expected fetch plugin');
    }

    await expect(
      runSuccess(fetchPlugin, {
        body: JSON.stringify({ callbackURL: 'myapp://auth/callback' }),
        data: {
          redirect: true,
          url: 'https://accounts.example.com/oauth'
        },
        requestURL: 'https://auth.example.com/neondb/auth/sign-in/social'
      })
    ).rejects.toThrow(
      'Neon Auth completed OAuth without returning a session verifier'
    );
  });
});
