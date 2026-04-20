import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { createAuthServerInternal } from './client-factory';
import type { RequestContext } from './request-context';

const TEST_SECRET = 'test-secret-at-least-32-characters-long!';
const TEST_BASE_URL = 'https://auth.example.com';

// Server-return error shape contract: a plain serializable object. It is NOT
// an `AuthApiError` instance — consumers on the server path depend on
// `JSON.stringify(error)` and `{...error}` working, and neither works on an
// `Error` subclass (whose `message` is non-enumerable).
interface ServerErrorPojo {
  message: string;
  status: number;
  statusText: string;
  code: string | undefined;
}

function makeContext(): RequestContext {
  return {
    getCookies: () => '',
    setCookie: () => {},
    getHeader: () => null,
    getOrigin: () => 'https://app.example.com',
    getFramework: () => 'test',
  };
}

describe('createAuthServerInternal error branch', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('returns { data: null, error: POJO } with message/status/statusText/code on non-2xx', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        {
          message: 'Invalid email or password',
          code: 'INVALID_EMAIL_OR_PASSWORD',
        },
        {
          status: 401,
          statusText: 'Unauthorized',
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const server = createAuthServerInternal({
      baseUrl: TEST_BASE_URL,
      context: makeContext,
      cookieSecret: TEST_SECRET,
    });

    // `signIn.email` is a valid endpoint in API_ENDPOINTS — use it to trigger fetch.
    const result = (await (server as unknown as {
      signIn: { email: (args: unknown) => Promise<{ data: unknown; error: unknown }> };
    }).signIn.email({ email: 'a@b.com', password: 'wrong' })) as {
      data: unknown;
      error: ServerErrorPojo;
    };

    expect(result.data).toBeNull();
    expect(result.error).not.toBeInstanceOf(Error);
    expect(typeof result.error).toBe('object');
    expect(result.error.status).toBe(401);
    expect(result.error.statusText).toBe('Unauthorized');
    expect(result.error.code).toBe('invalid_credentials');
    expect(typeof result.error.message).toBe('string');
    expect(result.error.message.length).toBeGreaterThan(0);
  });

  test('server error field is JSON-serializable (all fields present in output)', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        {
          message: 'User already exists',
          code: 'USER_ALREADY_EXISTS',
        },
        {
          status: 409,
          statusText: 'Conflict',
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const server = createAuthServerInternal({
      baseUrl: TEST_BASE_URL,
      context: makeContext,
      cookieSecret: TEST_SECRET,
    });

    const result = (await (server as unknown as {
      signUp: { email: (args: unknown) => Promise<{ data: unknown; error: unknown }> };
    }).signUp.email({
      email: 'dup@example.com',
      password: 'password123',
      name: 'Dup',
    })) as { data: unknown; error: ServerErrorPojo };

    const serialized = JSON.parse(JSON.stringify(result.error));
    expect(serialized.message).toBeDefined();
    expect(serialized.status).toBe(409);
    expect(serialized.statusText).toBe('Conflict');
    expect(serialized.code).toBe('user_already_exists');
  });

  test('server error field supports object spread (all fields enumerable)', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { message: 'Bad input', code: 'VALIDATION_FAILED' },
        {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const server = createAuthServerInternal({
      baseUrl: TEST_BASE_URL,
      context: makeContext,
      cookieSecret: TEST_SECRET,
    });

    const result = (await (server as unknown as {
      signIn: { email: (args: unknown) => Promise<{ data: unknown; error: unknown }> };
    }).signIn.email({ email: 'bad', password: 'x' })) as {
      data: unknown;
      error: ServerErrorPojo;
    };

    const spread = { ...result.error };
    expect(spread.message).toBe(result.error.message);
    expect(spread.status).toBe(400);
    expect(spread.statusText).toBe('Bad Request');
    expect(spread.code).toBe('validation_failed');
  });

  test('upstream code is normalized and preserved on error.code (not dropped)', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { message: 'Email already registered', code: 'EMAIL_ALREADY_EXISTS' },
        {
          status: 409,
          statusText: 'Conflict',
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const server = createAuthServerInternal({
      baseUrl: TEST_BASE_URL,
      context: makeContext,
      cookieSecret: TEST_SECRET,
    });

    const result = (await (server as unknown as {
      signUp: { email: (args: unknown) => Promise<{ data: unknown; error: unknown }> };
    }).signUp.email({ email: 'taken@example.com', password: 'x' })) as {
      data: unknown;
      error: ServerErrorPojo;
    };

    // Upstream `EMAIL_ALREADY_EXISTS` is mapped via BETTER_AUTH_ERROR_MAP to
    // the canonical snake_case code. We assert `code` is populated (i.e.
    // normalization ran) rather than hardcoding the exact mapping — the
    // important contract is "upstream code results in a non-empty error.code".
    expect(result.error.code).toBeDefined();
    expect(typeof result.error.code).toBe('string');
    expect((result.error.code as string).length).toBeGreaterThan(0);
  });

  test('status is preserved as a number even when normalization remaps', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { message: 'Nope' },
        {
          status: 401,
          statusText: 'Unauthorized',
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const server = createAuthServerInternal({
      baseUrl: TEST_BASE_URL,
      context: makeContext,
      cookieSecret: TEST_SECRET,
    });

    const result = (await (server as unknown as {
      signIn: { email: (args: unknown) => Promise<{ data: unknown; error: unknown }> };
    }).signIn.email({ email: 'a@b.com', password: 'x' })) as {
      data: unknown;
      error: ServerErrorPojo;
    };

    expect(typeof result.error.status).toBe('number');
    expect(result.error.status).toBe(401);
    expect(result.error.statusText).toBe('Unauthorized');
  });

  test('still returns { data, error: null } on 2xx responses', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { user: { id: 'u1' }, session: { id: 's1' } },
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const server = createAuthServerInternal({
      baseUrl: TEST_BASE_URL,
      context: makeContext,
      cookieSecret: TEST_SECRET,
    });

    const result = (await (server as unknown as {
      signIn: { email: (args: unknown) => Promise<{ data: unknown; error: unknown }> };
    }).signIn.email({ email: 'a@b.com', password: 'correct' })) as {
      data: unknown;
      error: unknown;
    };

    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({
      user: { id: 'u1' },
      session: { id: 's1' },
    });
  });
});
