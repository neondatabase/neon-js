import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { SignJWT } from 'jose';
import { createAuthServer } from '@/server/client-factory';
import { createNextRequestContext } from './adapter';
import {
  NEON_AUTH_SESSION_COOKIE_NAME,
  NEON_AUTH_SESSION_DATA_COOKIE_NAME,
} from '@/server/constants';
import type { RequireSessionData } from '@/server/types';
import type { BetterAuthSession, BetterAuthUser } from '@/core/better-auth-types';

const TEST_SECRET = 'test-secret-at-least-32-characters-long!';
const TEST_BASE_URL = 'https://auth.example.com';

class ReadonlyRequestCookiesError extends Error {
  constructor() {
    super(
      'Cookies can only be modified in a Server Action or Route Handler.'
    );
    this.name = 'ReadonlyRequestCookiesError';
  }
}

const sessionPayload: RequireSessionData = {
  session: {
    id: 'session-123',
    userId: 'user-123',
    token: 'opaque-token',
    expiresAt: new Date(Date.now() + 3_600_000),
    createdAt: new Date(),
    updatedAt: new Date(),
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
  } as BetterAuthSession,
  user: {
    id: 'user-123',
    email: 'test@example.com',
    emailVerified: true,
    name: 'Test User',
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as BetterAuthUser,
};

async function signSessionData(): Promise<string> {
  const encodedSecret = new TextEncoder().encode(TEST_SECRET);
  return new SignJWT(sessionPayload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 300)
    .setSubject(sessionPayload.user.id)
    .sign(encodedSecret);
}

type CookieStore = {
  get: (name: string) => { value: string } | undefined;
  set: ReturnType<typeof vi.fn>;
};

function createCookieStore(initial: Record<string, string>, mutable: boolean): CookieStore {
  const jar = new Map(Object.entries(initial));
  const setImpl = mutable
    ? vi.fn((name: string, value: string) => {
        jar.set(name, value);
      })
    : vi.fn(() => {
        throw new ReadonlyRequestCookiesError();
      });

  return {
    get: (name: string) => {
      const value = jar.get(name);
      return value === undefined ? undefined : { value };
    },
    set: setImpl,
  };
}

function cookieHeaderFromJar(jar: Record<string, string>): string {
  return Object.entries(jar)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

const workUnitStore = { type: 'request' as const, phase: 'render' as 'render' | 'action' };

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}));

vi.mock(
  'next/dist/server/app-render/work-unit-async-storage.external',
  () => ({
    workUnitAsyncStorage: {
      getStore: () => workUnitStore,
    },
  })
);

describe('createNextRequestContext + getSession cookie mutation contexts', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;
  let cookieStore: CookieStore;

  beforeEach(async () => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    workUnitStore.phase = 'render';

    const { cookies, headers } = await import('next/headers');
    cookieStore = createCookieStore({}, false);
    vi.mocked(cookies).mockResolvedValue(cookieStore as never);
    vi.mocked(headers).mockReturnValue(
      new Headers({
        cookie: '',
        origin: 'https://app.example.com',
      }) as never
    );
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  function makeServer() {
    return createAuthServer({
      baseUrl: TEST_BASE_URL,
      context: createNextRequestContext,
      cookieSecret: TEST_SECRET,
    });
  }

  test('A: RSC render phase with valid session_data cache succeeds without cookie writes', async () => {
    const sessionData = await signSessionData();
    const jar = {
      [NEON_AUTH_SESSION_COOKIE_NAME]: 'session-token-value',
      [NEON_AUTH_SESSION_DATA_COOKIE_NAME]: sessionData,
    };
    cookieStore = createCookieStore(jar, false);
    const { cookies, headers } = await import('next/headers');
    vi.mocked(cookies).mockResolvedValue(cookieStore as never);
    vi.mocked(headers).mockReturnValue(
      new Headers({
        cookie: cookieHeaderFromJar(jar),
        origin: 'https://app.example.com',
      }) as never
    );

    const server = makeServer();
    const result = await server.getSession();

    expect(result.error).toBeNull();
    expect(result.data?.user?.email).toBe('test@example.com');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  test('B: RSC render phase with expired session_data returns session without illegal cookie writes', async () => {
    const jar = {
      [NEON_AUTH_SESSION_COOKIE_NAME]: 'session-token-value',
    };
    cookieStore = createCookieStore(jar, false);
    const { cookies, headers } = await import('next/headers');
    vi.mocked(cookies).mockResolvedValue(cookieStore as never);
    vi.mocked(headers).mockReturnValue(
      new Headers({
        cookie: cookieHeaderFromJar(jar),
        origin: 'https://app.example.com',
      }) as never
    );

    fetchMock.mockResolvedValueOnce(
      Response.json(sessionPayload, {
        status: 200,
        headers: {
          'Set-Cookie': `${NEON_AUTH_SESSION_DATA_COOKIE_NAME}=refreshed; Path=/; HttpOnly; Secure; SameSite=Lax`,
        },
      })
    );

    const server = makeServer();
    const result = await server.getSession();

    expect(result.error).toBeNull();
    expect(result.data?.user?.email).toBe('test@example.com');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  test('C: route handler / server action phase still persists refreshed cookies', async () => {
    workUnitStore.phase = 'action';

    const jar = {
      [NEON_AUTH_SESSION_COOKIE_NAME]: 'session-token-value',
    };
    cookieStore = createCookieStore(jar, true);
    const { cookies, headers } = await import('next/headers');
    vi.mocked(cookies).mockResolvedValue(cookieStore as never);
    vi.mocked(headers).mockReturnValue(
      new Headers({
        cookie: cookieHeaderFromJar(jar),
        origin: 'https://app.example.com',
      }) as never
    );

    fetchMock.mockResolvedValueOnce(
      Response.json(sessionPayload, {
        status: 200,
        headers: {
          'Set-Cookie': `${NEON_AUTH_SESSION_DATA_COOKIE_NAME}=refreshed; Path=/; HttpOnly; Secure; SameSite=Lax`,
        },
      })
    );

    const server = makeServer();
    const result = await server.getSession();

    expect(result.error).toBeNull();
    expect(result.data?.user?.email).toBe('test@example.com');
    expect(cookieStore.set).toHaveBeenCalled();
  });

  test('RSC slow path with multiple upstream Set-Cookie headers skips all writes', async () => {
    const jar = {
      [NEON_AUTH_SESSION_COOKIE_NAME]: 'session-token-value',
    };
    cookieStore = createCookieStore(jar, false);
    const { cookies, headers } = await import('next/headers');
    vi.mocked(cookies).mockResolvedValue(cookieStore as never);
    vi.mocked(headers).mockReturnValue(
      new Headers({
        cookie: cookieHeaderFromJar(jar),
        origin: 'https://app.example.com',
      }) as never
    );

    const responseHeaders = new Headers({ 'Content-Type': 'application/json' });
    responseHeaders.append(
      'Set-Cookie',
      `${NEON_AUTH_SESSION_COOKIE_NAME}=rotated; Path=/; HttpOnly; Secure; SameSite=Lax`
    );
    responseHeaders.append(
      'Set-Cookie',
      `${NEON_AUTH_SESSION_DATA_COOKIE_NAME}=refreshed; Path=/; HttpOnly; Secure; SameSite=Lax`
    );

    fetchMock.mockResolvedValueOnce(
      Response.json(sessionPayload, {
        status: 200,
        headers: responseHeaders,
      })
    );

    const server = makeServer();
    const result = await server.getSession();

    expect(result.error).toBeNull();
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  test('RSC with no session cookies returns unauthenticated without cookie writes', async () => {
    cookieStore = createCookieStore({}, false);
    const { cookies, headers } = await import('next/headers');
    vi.mocked(cookies).mockResolvedValue(cookieStore as never);
    vi.mocked(headers).mockReturnValue(
      new Headers({
        cookie: '',
        origin: 'https://app.example.com',
      }) as never
    );

    fetchMock.mockResolvedValueOnce(
      Response.json({ session: null, user: null }, { status: 200 })
    );

    const server = makeServer();
    const result = await server.getSession();

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ session: null, user: null });
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  test('disableCookieCache bypasses local cache and still avoids illegal writes in RSC', async () => {
    const sessionData = await signSessionData();
    const jar = {
      [NEON_AUTH_SESSION_COOKIE_NAME]: 'session-token-value',
      [NEON_AUTH_SESSION_DATA_COOKIE_NAME]: sessionData,
    };
    cookieStore = createCookieStore(jar, false);
    const { cookies, headers } = await import('next/headers');
    vi.mocked(cookies).mockResolvedValue(cookieStore as never);
    vi.mocked(headers).mockReturnValue(
      new Headers({
        cookie: cookieHeaderFromJar(jar),
        origin: 'https://app.example.com',
      }) as never
    );

    fetchMock.mockResolvedValueOnce(
      Response.json(sessionPayload, {
        status: 200,
        headers: {
          'Set-Cookie': `${NEON_AUTH_SESSION_DATA_COOKIE_NAME}=refreshed; Path=/; HttpOnly; Secure; SameSite=Lax`,
        },
      })
    );

    const server = makeServer();
    const result = await server.getSession({
      query: { disableCookieCache: 'true' },
    });

    expect(result.error).toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(cookieStore.set).not.toHaveBeenCalled();
  });
});
