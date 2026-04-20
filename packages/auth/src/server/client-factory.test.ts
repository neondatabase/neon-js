import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { createAuthServerInternal } from './client-factory';
import type { RequestContext } from './request-context';
import { AuthApiError, AuthError } from '@/adapters/supabase/auth-interface';

const TEST_SECRET = 'test-secret-at-least-32-characters-long!';
const TEST_BASE_URL = 'https://auth.example.com';

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

  test('returns { data: null, error: <AuthApiError> } with .status and .code on non-2xx', async () => {
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
      error: unknown;
    };

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(AuthApiError);
    const err = result.error as AuthApiError;
    expect(err.status).toBe(401);
    expect(err.code).toBe('invalid_credentials');
    expect(typeof err.message).toBe('string');
  });

  test('consumer `instanceof AuthApiError` narrows the type on the returned error', async () => {
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
    })) as { data: unknown; error: unknown };

    // Consumer pattern
    if (result.error instanceof AuthApiError) {
      // TypeScript has narrowed `result.error` to AuthApiError here.
      expect(result.error.status).toBe(409);
      expect(result.error.code).toBe('user_already_exists');
    } else {
      throw new Error(
        `Expected AuthApiError but got ${
          (result.error as { constructor?: { name?: string } })?.constructor
            ?.name ?? typeof result.error
        }`
      );
    }
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

  test('error still extends Error (backward compatible) and exposes `.status` as number', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ message: 'Nope' }, {
        status: 401,
        statusText: 'Unauthorized',
        headers: { 'Content-Type': 'application/json' },
      })
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
      error: unknown;
    };

    // AuthApiError extends AuthError extends Error, so legacy consumers that
    // did `(err as { status?: number })?.status` still get a number back.
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error).toBeInstanceOf(AuthError);
    expect(typeof (result.error as AuthError).status).toBe('number');
    expect((result.error as AuthError).status).toBe(401);
  });
});
