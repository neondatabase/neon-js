import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { contextStorage } from 'hono/context-storage';
import { createNeonAuth, honoAuthHandler, neonAuthHonoMiddleware, createHonoRequestContext } from './index';
import { honoRequestContextFromContext } from './adapter';
import type { NeonAuthConfig } from '@/server/config';
import { ERRORS } from '@/server/errors';
import * as proxy from '@/server/proxy';
import * as middleware from '@/server/middleware';

const createAuthConfig = (
  overrides?: Partial<NeonAuthConfig['cookies']>
): NeonAuthConfig => ({
  baseUrl: 'https://auth.example.com',
  cookies: { secret: 'x'.repeat(32), ...overrides },
});

describe('createNeonAuth config validation', () => {
  test('accepts valid config with all fields', () => {
    expect(() => createNeonAuth(
      createAuthConfig({ secret: 'x'.repeat(32), sessionDataTtl: 300, domain: '.example.com' })
    )).not.toThrow();
  });

  test('accepts minimal config', () => {
    expect(() => createNeonAuth(createAuthConfig())).not.toThrow();
  });

  test('throws when cookies.secret is missing', () => {
    expect(() =>
      createNeonAuth({ baseUrl: 'https://auth.example.com', cookies: {} as never })
    ).toThrow(ERRORS.MISSING_COOKIE_SECRET);
  });

  test('throws when cookies.secret is too short', () => {
    expect(() => createNeonAuth(createAuthConfig({ secret: 'short-secret' }))).toThrow(
      'at least 32 characters'
    );
  });

  test('throws when sessionDataTtl is zero or negative', () => {
    expect(() => createNeonAuth(createAuthConfig({ sessionDataTtl: 0 }))).toThrow('positive number');
    expect(() => createNeonAuth(createAuthConfig({ sessionDataTtl: -5 }))).toThrow('positive number');
  });

  test.each(['strict', 'lax', 'none'] as const)(
    'accepts cookies.sameSite=%s',
    (sameSite) => {
      expect(() => createNeonAuth(createAuthConfig({ sameSite }))).not.toThrow();
    }
  );
});

describe('createNeonAuth return shape', () => {
  test('exposes handler() and middleware() factories', () => {
    const auth = createNeonAuth(createAuthConfig());
    expect(typeof auth.handler).toBe('function');
    expect(typeof auth.middleware).toBe('function');
  });

  test('handler() returns a Hono-compatible async handler', () => {
    const auth = createNeonAuth(createAuthConfig());
    const handler = auth.handler();
    expect(typeof handler).toBe('function');
  });

  test('middleware() returns a Hono MiddlewareHandler', () => {
    const auth = createNeonAuth(createAuthConfig());
    const mw = auth.middleware({ loginUrl: '/sign-in' });
    expect(typeof mw).toBe('function');
  });
});

describe('createHonoRequestContext', () => {
  test('throws when called outside a contextStorage() scope', () => {
    // No `app.use(contextStorage())` context is active here, so
    // `getContext()` must reject.
    expect(() => createHonoRequestContext()).toThrow();
  });
});

describe('honoRequestContextFromContext (contract)', () => {
  const runInContext = async (
    request: Request,
    fn: (ctx: ReturnType<typeof honoRequestContextFromContext>) => Promise<void> | void
  ): Promise<Response> => {
    const app = new Hono();
    app.use(contextStorage());
    app.all('/*', async (c) => {
      const ctx = honoRequestContextFromContext(c);
      await fn(ctx);
      return c.text('ok');
    });
    return app.fetch(request);
  };

  test('getCookies() returns the raw Cookie header (empty string when absent)', async () => {
    const seen: string[] = [];
    await runInContext(new Request('https://app/'), async (ctx) => {
      seen.push(await ctx.getCookies());
    });
    await runInContext(
      new Request('https://app/', { headers: { cookie: 'foo=1; bar=2' } }),
      async (ctx) => {
        seen.push(await ctx.getCookies());
      }
    );
    expect(seen).toEqual(['', 'foo=1; bar=2']);
  });

  test('getHeader() is case-insensitive and returns null when absent', async () => {
    const seen: (string | null)[] = [];
    await runInContext(
      new Request('https://app/', { headers: { 'X-Custom': 'yes', 'x-other': 'no' } }),
      async (ctx) => {
        seen.push(
          await ctx.getHeader('X-Custom'),
          await ctx.getHeader('x-custom'),
          await ctx.getHeader('X-Missing'),
        );
      }
    );
    expect(seen).toEqual(['yes', 'yes', null]);
  });

  test('getOrigin() prefers Origin, falls back to Referer stem, then empty string', async () => {
    const seen: string[] = [];
    await runInContext(
      new Request('https://app/', { headers: { origin: 'https://foo.example.com' } }),
      async (ctx) => {
        seen.push(await ctx.getOrigin());
      }
    );
    await runInContext(
      new Request('https://app/', {
        headers: { referer: 'https://bar.example.com/some/path?q=1' },
      }),
      async (ctx) => {
        seen.push(await ctx.getOrigin());
      }
    );
    await runInContext(new Request('https://app/'), async (ctx) => {
      seen.push(await ctx.getOrigin());
    });
    expect(seen).toEqual([
      'https://foo.example.com',
      'https://bar.example.com',
      '',
    ]);
  });

  test('getFramework() identifies the adapter as "hono"', async () => {
    const seen: string[] = [];
    await runInContext(new Request('https://app/'), (ctx) => {
      seen.push(ctx.getFramework());
    });
    expect(seen).toEqual(['hono']);
  });

  test('setCookie() appends a Set-Cookie header on the response', async () => {
    const app = new Hono();
    app.use(contextStorage());
    app.all('/*', async (c) => {
      const ctx = honoRequestContextFromContext(c);
      ctx.setCookie('sess', 'abc', {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 60,
      });
      return c.text('ok');
    });
    const res = await app.fetch(new Request('https://app/'));
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toMatch(/^sess=abc;/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/Secure/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Max-Age=60/i);
  });
});

describe('honoAuthHandler path stripping', () => {
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    spy = vi.spyOn(proxy, 'handleAuthProxyRequest').mockResolvedValue(
      new Response(null, { status: 204 })
    );
  });

  afterEach(() => {
    spy.mockRestore();
  });

  test.each([
    ['https://app.example.com/api/auth/sign-in/email', 'sign-in/email'],
    ['https://app.example.com/api/auth/', ''],
    ['https://app.example.com/api/auth/callback?code=xyz', 'callback'],
  ])('strips /api/auth/ prefix: %s → %s', async (url, expectedPath) => {
    const app = new Hono();
    app.use(contextStorage());
    app.all('/api/auth/*', honoAuthHandler(createAuthConfig()));
    await app.fetch(new Request(url, { method: 'POST' }));
    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0]![0] as { path: string };
    expect(arg.path).toBe(expectedPath);
  });

  test('forwards the raw Fetch Request to the toolkit', async () => {
    const app = new Hono();
    app.use(contextStorage());
    app.all('/api/auth/*', honoAuthHandler(createAuthConfig()));
    const req = new Request('https://app.example.com/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.c', password: 'x' }),
    });
    await app.fetch(req);
    const arg = spy.mock.calls[0]![0] as { request: Request; baseUrl: string; cookieSecret: string };
    expect(arg.request).toBeInstanceOf(Request);
    expect(arg.baseUrl).toBe('https://auth.example.com');
    expect(arg.cookieSecret).toBe('x'.repeat(32));
  });
});

describe('neonAuthHonoMiddleware — MiddlewareResult mapping', () => {
  let spy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    spy.mockRestore();
  });

  test('action=allow: forwards signal headers onto downstream request, appends cookies to response, calls next()', async () => {
    spy = vi.spyOn(middleware, 'processAuthMiddleware').mockResolvedValue({
      action: 'allow',
      headers: { 'x-neon-auth-middleware': 'true' },
      cookies: [
        '__Secure-neon-auth.local.session_data=fresh; Path=/; HttpOnly; Secure',
      ],
    });

    const app = new Hono();
    app.use(contextStorage());
    app.use('*', neonAuthHonoMiddleware(createAuthConfig()));
    app.get('/protected', (c) =>
      c.text(`sig=${c.req.header('x-neon-auth-middleware') ?? 'missing'}`)
    );

    const res = await app.fetch(
      new Request('https://app.example.com/protected')
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('sig=true');
    expect(res.headers.getSetCookie()).toEqual([
      '__Secure-neon-auth.local.session_data=fresh; Path=/; HttpOnly; Secure',
    ]);
  });

  test('action=redirect_oauth: 302 with location + verifier-clearing cookies', async () => {
    const target = new URL('https://app.example.com/dashboard');
    spy = vi.spyOn(middleware, 'processAuthMiddleware').mockResolvedValue({
      action: 'redirect_oauth',
      redirectUrl: target,
      cookies: [
        '__Secure-neon-auth.local.session_challenge=; Path=/; Max-Age=0',
      ],
    });

    const app = new Hono();
    app.use(contextStorage());
    app.use('*', neonAuthHonoMiddleware(createAuthConfig()));

    const res = await app.fetch(
      new Request('https://app.example.com/dashboard?code=xyz')
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(target.toString());
    expect(res.headers.getSetCookie()).toEqual([
      '__Secure-neon-auth.local.session_challenge=; Path=/; Max-Age=0',
    ]);
  });

  test('action=redirect_login: 302 to loginUrl, clears stale cookies when present', async () => {
    const target = new URL('https://app.example.com/sign-in');
    spy = vi.spyOn(middleware, 'processAuthMiddleware').mockResolvedValue({
      action: 'redirect_login',
      redirectUrl: target,
      cookies: [
        '__Secure-neon-auth.local.session_token=; Path=/; Max-Age=0',
      ],
    });

    const app = new Hono();
    app.use(contextStorage());
    app.use('*', neonAuthHonoMiddleware({ ...createAuthConfig(), loginUrl: '/sign-in' }));

    const res = await app.fetch(
      new Request('https://app.example.com/protected')
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(target.toString());
    expect(res.headers.getSetCookie()).toEqual([
      '__Secure-neon-auth.local.session_token=; Path=/; Max-Age=0',
    ]);
  });

  test('action=redirect_login without cookies: plain 302 to loginUrl', async () => {
    const target = new URL('https://app.example.com/sign-in');
    spy = vi.spyOn(middleware, 'processAuthMiddleware').mockResolvedValue({
      action: 'redirect_login',
      redirectUrl: target,
    });

    const app = new Hono();
    app.use(contextStorage());
    app.use('*', neonAuthHonoMiddleware({ ...createAuthConfig(), loginUrl: '/sign-in' }));

    const res = await app.fetch(
      new Request('https://app.example.com/protected')
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(target.toString());
    expect(res.headers.getSetCookie()).toEqual([]);
  });
});
