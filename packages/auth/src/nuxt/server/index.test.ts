import { afterEach, describe, expect, test, vi } from 'vitest';
import type { H3Event } from 'h3';
import { createNuxtRequestContext } from './adapter';
import { createNeonAuth } from './index';
import {
  applyMiddlewareResult,
  matchesProtectedRoute,
} from './middleware';
import { ERRORS } from '../../server/errors';

const COOKIE_SECRET = 'nuxt-test-secret-at-least-32-characters';

type HeaderValue = string | number | readonly string[];

interface FakeResponse {
  statusCode: number;
  statusMessage?: string;
  ended: boolean;
  body?: string;
  setHeader(name: string, value: HeaderValue): void;
  getHeader(name: string): HeaderValue | undefined;
  getHeaders(): Record<string, HeaderValue>;
  removeHeader(name: string): void;
  end(body?: string): void;
}

function createFakeResponse(): FakeResponse {
  const headers = new Map<string, HeaderValue>();

  return {
    statusCode: 200,
    ended: false,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(name.toLowerCase());
    },
    getHeaders() {
      return Object.fromEntries(headers);
    },
    removeHeader(name) {
      headers.delete(name.toLowerCase());
    },
    end(body) {
      this.ended = true;
      this.body = body;
    },
  };
}

function createEvent(
  url: string,
  options?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }
): { event: H3Event; response: FakeResponse } {
  const parsedUrl = new URL(url);
  const method = options?.method ?? 'GET';
  const requestHeaders: Record<string, string> = {
    host: parsedUrl.host,
    'x-forwarded-proto': parsedUrl.protocol.slice(0, -1),
    ...options?.headers,
  };
  const response = createFakeResponse();

  const event = {
    node: {
      req: {
        method,
        url: `${parsedUrl.pathname}${parsedUrl.search}`,
        headers: requestHeaders,
        socket: {},
      },
      res: response,
    },
    context: {},
    method,
    path: `${parsedUrl.pathname}${parsedUrl.search}`,
    headers: new Headers(requestHeaders),
    handled: false,
    _requestBody:
      options?.body === undefined ? undefined : Buffer.from(options.body),
  } as unknown as H3Event;

  return { event, response };
}

function createConfig() {
  return {
    baseUrl: 'https://auth.example.com',
    cookies: {
      secret: COOKIE_SECRET,
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('createNeonAuth', () => {
  test('validates cookie configuration and exposes the event-bound API', () => {
    expect(() =>
      createNeonAuth({
        baseUrl: 'https://auth.example.com',
        cookies: { secret: 'short' },
      })
    ).toThrow(ERRORS.COOKIE_SECRET_TOO_SHORT);

    const auth = createNeonAuth(createConfig());
    expect(auth.withEvent).toBeTypeOf('function');
    expect(auth.handler).toBeTypeOf('function');
    expect(auth.middleware).toBeTypeOf('function');
  });

  test('isolates concurrent server proxies by H3 event', async () => {
    const fetchMock = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        return Response.json({
          cookie: headers.get('cookie'),
          framework: headers.get('x-neon-auth-proxy'),
        });
      }
    );
    vi.stubGlobal('fetch', fetchMock);

    const auth = createNeonAuth(createConfig());
    const { event: firstEvent } = createEvent('https://app.example.com/one', {
      headers: {
        cookie:
          '__Secure-neon-auth.session_token=first; unrelated=not-forwarded',
        origin: 'https://first.example.com',
      },
    });
    const { event: secondEvent } = createEvent('https://app.example.com/two', {
      headers: {
        cookie: '__Secure-neon-auth.session_token=second',
        origin: 'https://second.example.com',
      },
    });

    const [first, second] = await Promise.all([
      auth
        .withEvent(firstEvent)
        .getSession({ query: { disableCookieCache: 'true' } }),
      auth
        .withEvent(secondEvent)
        .getSession({ query: { disableCookieCache: 'true' } }),
    ]);

    expect(first.data).toEqual({
      cookie: '__Secure-neon-auth.session_token=first',
      framework: 'nuxt',
    });
    expect(second.data).toEqual({
      cookie: '__Secure-neon-auth.session_token=second',
      framework: 'nuxt',
    });
  });
});

describe('Nuxt request context', () => {
  test('bridges cookies, headers, origin, response cookies, and telemetry', () => {
    const { event, response } = createEvent('https://app.example.com/page', {
      headers: {
        cookie:
          '__Secure-neon-auth.session_token=token; unrelated=not-forwarded',
        referer: 'https://referrer.example.com/from/here',
        'x-test': 'value',
      },
    });
    const context = createNuxtRequestContext(event);

    expect(context.getCookies()).toBe(
      '__Secure-neon-auth.session_token=token'
    );
    expect(context.getHeader('x-test')).toBe('value');
    expect(context.getHeader('missing')).toBeNull();
    expect(context.getOrigin()).toBe('https://referrer.example.com');
    expect(context.getFramework()).toBe('nuxt');

    context.setCookie('test', 'value', {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });

    expect(response.getHeader('set-cookie')).toBe(
      'test=value; Path=/; HttpOnly; Secure; SameSite=Lax'
    );
  });

  test('prefers Origin and safely handles a malformed Referer', () => {
    const { event: originEvent } = createEvent('https://app.example.com', {
      headers: {
        origin: 'https://origin.example.com',
        referer: 'https://ignored.example.com/path',
      },
    });
    const { event: malformedEvent } = createEvent('https://app.example.com', {
      headers: { referer: 'not a URL' },
    });

    expect(createNuxtRequestContext(originEvent).getOrigin()).toBe(
      'https://origin.example.com'
    );
    expect(createNuxtRequestContext(malformedEvent).getOrigin()).toBe('');
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
    const { event, response } = createEvent(
      'https://app.example.com/api/auth/sign-in/email?scope=a&scope=b&empty=',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: rawBody,
      }
    );

    const result = await auth.handler()(event);
    const responseBody = await new Response(
      result as BodyInit | null
    ).text();

    expect(upstreamUrl?.pathname).toBe('/sign-in/email');
    expect(upstreamUrl?.searchParams.getAll('scope')).toEqual(['a', 'b']);
    expect(upstreamUrl?.searchParams.has('empty')).toBe(true);
    expect(upstreamBody).toBe(rawBody);
    expect(response.statusCode).toBe(201);
    expect(response.getHeader('set-cookie')).toHaveLength(2);
    expect(responseBody).toBe('{"ok":true}');
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
    const { event, response } = createEvent('https://app.example.com/private');

    await applyMiddlewareResult(event, {
      action: 'allow',
      headers: { 'x-neon-auth-middleware': 'true' },
      cookies: ['first=one', 'second=two'],
    });

    expect(event.node.req.headers['x-neon-auth-middleware']).toBe('true');
    expect(response.getHeader('set-cookie')).toEqual([
      'first=one',
      'second=two',
    ]);
    expect(response.ended).toBe(false);
  });

  test.each(['redirect_oauth', 'redirect_login'] as const)(
    'maps %s results with redirect cookies',
    async (action) => {
      const { event, response } = createEvent(
        'https://app.example.com/private'
      );
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

      await applyMiddlewareResult(event, result);

      expect(response.statusCode).toBe(302);
      expect(response.getHeader('location')).toBe(
        result.redirectUrl.toString()
      );
      expect(response.getHeader('set-cookie')).toBe(result.cookies[0]);
      expect(response.ended).toBe(true);
    }
  );

  test('skips public routes without a verifier', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const auth = createNeonAuth(createConfig());
    const { event, response } = createEvent(
      'https://app.example.com/marketing'
    );

    await auth.middleware({ protectedRoutes: ['/dashboard'] })(event);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.ended).toBe(false);
  });

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
    const { event, response } = createEvent(
      'https://app.example.com/marketing?neon_auth_session_verifier=verifier',
      {
        headers: {
          cookie: '__Secure-neon-auth.session_challenge=challenge',
        },
      }
    );

    await auth.middleware({ protectedRoutes: ['/dashboard'] })(event);

    expect(response.statusCode).toBe(302);
    expect(response.getHeader('location')).toBe(
      'https://app.example.com/marketing'
    );
    expect(response.getHeader('set-cookie')).toBe(
      'oauth=complete; Path=/; HttpOnly; Secure; SameSite=Lax'
    );
  });
});
