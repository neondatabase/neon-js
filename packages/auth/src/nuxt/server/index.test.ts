import {
  createApp,
  defineEventHandler,
  toPlainHandler,
  type EventHandler,
  type PlainResponse,
} from 'h3';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createNuxtRequestContext } from './adapter';
import { createNeonAuth } from './index';
import {
  applyMiddlewareResult,
  matchesProtectedRoute,
} from './middleware';

const COOKIE_SECRET = 'nuxt-test-secret-at-least-32-characters';

function createConfig() {
  return {
    baseUrl: 'https://auth.example.com',
    cookies: {
      secret: COOKIE_SECRET,
    },
  };
}

function callHandler(
  handler: EventHandler,
  {
    path = '/',
    method = 'GET',
    headers = {},
    body,
  }: {
    path?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {}
) {
  const app = createApp().use(handler);
  return toPlainHandler(app)({
    method,
    path,
    headers: {
      host: 'app.example.com',
      'x-forwarded-proto': 'https',
      ...headers,
    },
    body,
  });
}

function getHeaders(response: PlainResponse, name: string) {
  return response.headers
    .filter(([key]) => key.toLowerCase() === name.toLowerCase())
    .map(([, value]) => value);
}

function getBody<T>(response: PlainResponse): T {
  return (
    typeof response.body === 'string'
      ? JSON.parse(response.body)
      : response.body
  ) as T;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('createNeonAuth', () => {
  test('isolates concurrent server proxies by H3 event', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async (_input: string | URL | Request, init?: RequestInit) => {
          const headers = new Headers(init?.headers);
          return Response.json({
            cookie: headers.get('cookie'),
            framework: headers.get('x-neon-auth-proxy'),
          });
        }
      )
    );

    const auth = createNeonAuth(createConfig());
    const handler = defineEventHandler((event) =>
      auth
        .withEvent(event)
        .getSession({ query: { disableCookieCache: 'true' } })
    );

    const [first, second] = await Promise.all([
      callHandler(handler, {
        path: '/one',
        headers: {
          cookie:
            '__Secure-neon-auth.session_token=first; unrelated=not-forwarded',
          origin: 'https://first.example.com',
        },
      }),
      callHandler(handler, {
        path: '/two',
        headers: {
          cookie: '__Secure-neon-auth.session_token=second',
          origin: 'https://second.example.com',
        },
      }),
    ]);

    expect(getBody<{ data: unknown }>(first).data).toEqual({
      cookie: '__Secure-neon-auth.session_token=first',
      framework: 'nuxt',
    });
    expect(getBody<{ data: unknown }>(second).data).toEqual({
      cookie: '__Secure-neon-auth.session_token=second',
      framework: 'nuxt',
    });
  });
});

describe('Nuxt request context', () => {
  test('bridges request and response state', async () => {
    const response = await callHandler(defineEventHandler((event) => {
      const context = createNuxtRequestContext(event);
      context.setCookie('test', 'value', {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
      });
      return {
        cookies: context.getCookies(),
        header: context.getHeader('x-test'),
        origin: context.getOrigin(),
        framework: context.getFramework(),
      };
    }), {
      path: '/page',
      headers: {
        cookie:
          '__Secure-neon-auth.session_token=token; unrelated=not-forwarded',
        referer: 'https://referrer.example.com/from/here',
        'x-test': 'value',
      },
    });

    expect(getBody(response)).toEqual({
      cookies: '__Secure-neon-auth.session_token=token',
      header: 'value',
      origin: 'https://referrer.example.com',
      framework: 'nuxt',
    });
    expect(getHeaders(response, 'set-cookie')).toEqual([
      'test=value; Path=/; HttpOnly; Secure; SameSite=Lax',
    ]);
  });
});

describe('Nuxt handler', () => {
  test('forwards catch-all path, duplicate query values, and raw body', async () => {
    let upstreamUrl: URL | undefined;
    let upstreamBody: string | undefined;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        upstreamUrl = new URL(String(input));
        upstreamBody =
          typeof init?.body === 'string' ? init.body : String(init?.body ?? '');

        const headers = new Headers({ 'content-type': 'application/json' });
        headers.append('set-cookie', 'first=one; Path=/; HttpOnly');
        headers.append(
          'set-cookie',
          'second=two; Expires=Wed, 01 Jan 2031 00:00:00 GMT; Path=/'
        );

        return new Response('{"ok":true}', {
          status: 201,
          headers,
        });
      })
    );

    const auth = createNeonAuth(createConfig());
    const rawBody = '{ "email": "user@example.com" }\n';
    const response = await callHandler(auth.handler(), {
      path: '/api/auth/sign-in/email?scope=a&scope=b&empty=',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: rawBody,
    });

    expect(upstreamUrl?.pathname).toBe('/sign-in/email');
    expect(upstreamUrl?.searchParams.getAll('scope')).toEqual(['a', 'b']);
    expect(upstreamUrl?.searchParams.has('empty')).toBe(true);
    expect(upstreamBody).toBe(rawBody);
    expect(response.status).toBe(201);
    expect(getHeaders(response, 'set-cookie')).toHaveLength(2);
    expect(await new Response(response.body as BodyInit).text()).toBe(
      '{"ok":true}'
    );
  });
});

describe('Nuxt middleware', () => {
  test('uses segment-aware protected route prefixes', () => {
    expect(matchesProtectedRoute('/dashboard', ['/dashboard'])).toBe(true);
    expect(matchesProtectedRoute('/dashboard/settings', ['/dashboard/'])).toBe(
      true
    );
    expect(matchesProtectedRoute('/dashboard-admin', ['/dashboard'])).toBe(
      false
    );
    expect(matchesProtectedRoute('/anything', ['/'])).toBe(true);
  });

  test('maps allow results with request headers and multiple cookies', async () => {
    const response = await callHandler(defineEventHandler(async (event) => {
      await applyMiddlewareResult(event, {
        action: 'allow',
        headers: { 'x-neon-auth-middleware': 'true' },
        cookies: ['first=one', 'second=two'],
      });
      return {
        header: event.node.req.headers['x-neon-auth-middleware'],
      };
    }), {
      path: '/private',
    });

    expect(getBody<{ header: string }>(response).header).toBe('true');
    expect(getHeaders(response, 'set-cookie')).toEqual(['first=one', 'second=two']);
  });

  test.each(['redirect_oauth', 'redirect_login'] as const)(
    'maps %s results with redirect cookies',
    async (action) => {
      const result =
        action === 'redirect_oauth'
          ? {
              action,
              redirectUrl: new URL('https://app.example.com/after-oauth'),
              cookies: ['oauth=complete'],
            }
          : {
              action,
              redirectUrl: new URL('https://app.example.com/auth/sign-in'),
              cookies: ['stale=; Max-Age=0'],
            };

      const response = await callHandler(defineEventHandler(async (event) => {
        await applyMiddlewareResult(event, result);
      }), {
        path: '/private',
      });

      expect(response.status).toBe(302);
      expect(getHeaders(response, 'location')).toEqual([
        result.redirectUrl.toString(),
      ]);
      expect(getHeaders(response, 'set-cookie')).toEqual(result.cookies);
    }
  );

  test('processes verifier callbacks outside protected routes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const headers = new Headers();
        headers.append('set-cookie', 'oauth=complete; Path=/; HttpOnly');
        return Response.json({ session: null, user: null }, { headers });
      })
    );

    const auth = createNeonAuth(createConfig());
    const response = await callHandler(
      auth.middleware({ protectedRoutes: ['/dashboard'] }),
      {
        path: '/marketing?neon_auth_session_verifier=verifier',
        headers: {
          cookie: '__Secure-neon-auth.session_challenge=challenge',
        },
      }
    );

    expect(response.status).toBe(302);
    expect(getHeaders(response, 'location')).toEqual([
      'https://app.example.com/marketing',
    ]);
    expect(getHeaders(response, 'set-cookie')).toEqual([
      'oauth=complete; Path=/; HttpOnly; Secure; SameSite=Lax',
    ]);
  });
});
