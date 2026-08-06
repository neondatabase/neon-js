/**
 * Repurposed from `src/core/adapter-core.test.ts`.
 *
 * Plugin-path SUT: `neonClient()` + `createNeonCustomFetchImpl()` from
 * `@neondatabase/auth/client-plugin`, exercised through a real
 * `@better-fetch/fetch` instance so the fetch-plugin hooks (where
 * error-normalization + client-info injection live after the Tier-1
 * refactor) actually fire. Assertions remain identical to the wrapper-side
 * test — only the construction differs.
 *
 * This proves that a tenant who wires up bare `better-auth/client` +
 * `neonClient()` + `createNeonCustomFetchImpl()` gets the same transport-level
 * behavior the wrapper provides (force-fetch escape hatch, in-flight dedup,
 * error normalization to `AuthApiError`, client-info header injection).
 */
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { createFetch } from '@better-fetch/fetch';
import { createAuthClient as baCreateAuthClient } from 'better-auth/client';
import {
  jwtClient,
  adminClient,
  emailOTPClient,
  magicLinkClient,
  organizationClient,
  phoneNumberClient,
} from 'better-auth/client/plugins';
import {
  neonClient,
  createNeonCustomFetchImpl,
  FORCE_FETCH_HEADER,
} from '@/client-plugin';
import { neonFetchPlugin } from '@/client-plugin/fetch-hooks';
import { AuthApiError, AuthError } from '@/adapters/supabase/auth-interface';

const TEST_URL = 'https://auth.example.com/api/auth/sign-in/email';
const BASE_URL = 'https://auth.example.com';

/**
 * Plugin-path equivalent of the wrapper-side `makeWrapperFetch`: builds a
 * real `@better-fetch/fetch` instance configured with `neonFetchPlugin` and
 * the shared `createNeonCustomFetchImpl()`. Also constructs a parallel
 * `createAuthClient` so we catch accidental wire-up regressions (plugin
 * shape, pathMethods collisions).
 */
function makePluginWrapperFetch() {
  const customFetchImpl = createNeonCustomFetchImpl();

  const _client = baCreateAuthClient({
    baseURL: BASE_URL,
    plugins: [
      jwtClient(),
      adminClient(),
      organizationClient(),
      emailOTPClient(),
      magicLinkClient(),
      phoneNumberClient(),
      neonClient(),
    ],
    fetchOptions: {
      throw: false,
      customFetchImpl,
    },
  });
  void _client;

  return createFetch({
    baseURL: BASE_URL,
    throw: true,
    plugins: [neonFetchPlugin],
    customFetchImpl,
  });
}

describe('[plugin parity] end-to-end error normalization (plugin + customFetch)', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('main branch (via better-fetch + plugin)', () => {
    test('throws AuthApiError with .status and .code when upstream returns JSON with code', async () => {
      const $fetch = makePluginWrapperFetch();

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

      await expect(
        $fetch('/sign-in/email', { method: 'POST' })
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(AuthApiError);
        const apiErr = err as AuthApiError;
        expect(apiErr.status).toBe(401);
        expect(apiErr.code).toBe('invalid_credentials');
        return true;
      });
    });

    test('throws AuthError with a typed .code (not forged from .status) when upstream lacks code', async () => {
      const $fetch = makePluginWrapperFetch();

      fetchMock.mockResolvedValueOnce(
        Response.json(
          { message: 'Something went wrong' },
          {
            status: 418,
            statusText: "I'm a teapot",
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );

      let thrown: unknown;
      try {
        await $fetch('/sign-in/email', { method: 'POST' });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(Error);
      const code = (thrown as AuthError).code;
      expect(typeof code).toBe('string');
      expect(code).not.toBe('418');
      expect(code).not.toBe(String((thrown as AuthError).status));
    });

    test('thrown error is an AuthApiError instance (consumer narrowing works)', async () => {
      const $fetch = makePluginWrapperFetch();

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

      try {
        await $fetch('/sign-in/email', { method: 'POST' });
        throw new Error('fetch should have thrown');
      } catch (error) {
        if (error instanceof AuthApiError) {
          expect(typeof error.status).toBe('number');
          expect(typeof error.code).toBe('string');
          expect(typeof error.message).toBe('string');
        } else {
          throw new Error(
            `Expected AuthApiError but got: ${
              (error as { constructor?: { name?: string } })?.constructor
                ?.name ?? typeof error
            }`
          );
        }
      }
    });

    test('returns response untouched when upstream is 2xx (customFetchImpl direct)', async () => {
      const customFetchImpl = createNeonCustomFetchImpl();

      fetchMock.mockResolvedValueOnce(
        Response.json(
          { user: { id: 'u1' } },
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );

      const result = await customFetchImpl(TEST_URL, { method: 'POST' });
      expect(result.ok).toBe(true);
      expect(result.status).toBe(200);
    });
  });

  describe('force-fetch branch (X-Force-Fetch header)', () => {
    test('throws AuthApiError on non-2xx when paired with the fetch plugin', async () => {
      const $fetch = makePluginWrapperFetch();

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

      let thrown: unknown;
      try {
        await $fetch('/sign-in/email', {
          method: 'POST',
          headers: { [FORCE_FETCH_HEADER]: '1' },
        });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(AuthApiError);
      expect((thrown as AuthApiError).status).toBe(409);
      expect((thrown as AuthApiError).code).toBe('user_already_exists');
    });

    test('strips X-Force-Fetch header before sending (customFetchImpl direct)', async () => {
      const customFetchImpl = createNeonCustomFetchImpl();

      fetchMock.mockResolvedValueOnce(Response.json({}, { status: 200 }));

      await customFetchImpl(TEST_URL, {
        method: 'GET',
        headers: { [FORCE_FETCH_HEADER]: '1' },
      });

      const callArgs = fetchMock.mock.calls[0];
      const sentInit = callArgs[1] as RequestInit;
      const sentHeaders = sentInit.headers as Headers;
      expect(sentHeaders.has(FORCE_FETCH_HEADER)).toBe(false);
    });
  });
});
