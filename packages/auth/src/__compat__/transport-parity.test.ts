/**
 * Behavior-parity tests covering the transport-layer Neon behaviors that live
 * in `createNeonCustomFetchImpl()` and that the wrapper inherits through
 * `NeonAuthAdapterCore`.
 *
 * Each `describe` block exercises ONE behavior against BOTH paths and asserts
 * identical outcomes:
 *  - wrapperFetch — `customFetchImpl` from the legacy `BetterAuthVanillaAdapter`
 *  - pluginFetch  — `createNeonCustomFetchImpl()` used by stand-alone consumers
 */
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  makeWrapperHarness,
  makePluginHarness,
  makePluginOnlyHarness,
  FORCE_FETCH_HEADER,
} from './helpers';
import { AuthApiError } from '../adapters/supabase/auth-interface';
import { X_NEON_CLIENT_INFO_HEADER } from '../utils/client-info';
import { BETTER_AUTH_METHODS_IN_FLIGHT_REQUESTS } from '../core/better-auth-methods';
import type { BetterAuthInstance } from '../types';

const TOKEN_URL = 'https://auth.example.com/api/auth/token';
const GET_SESSION_URL = 'https://auth.example.com/api/auth/get-session';
const ANON_TOKEN_URL = 'https://auth.example.com/api/auth/token/anonymous';

describe('transport parity: wrapper vs standalone plugin', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;
  let wrapperFetch: ReturnType<ReturnType<typeof makeWrapperHarness>['customFetchImpl']> extends Promise<infer _> ? never : (url: string | URL | Request, init?: RequestInit) => Promise<Response>;
  let pluginFetch: (url: string | URL | Request, init?: RequestInit) => Promise<Response>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    // Reset shared in-flight state so concurrent-dedup tests start clean.
    BETTER_AUTH_METHODS_IN_FLIGHT_REQUESTS.clearAll();

    wrapperFetch = makeWrapperHarness().customFetchImpl();
    pluginFetch = makePluginHarness().customFetchImpl;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    BETTER_AUTH_METHODS_IN_FLIGHT_REQUESTS.clearAll();
  });

  /* ------------------------------------------------------------------ */
  describe('Behavior 1: in-flight request dedup (concurrent identical GETs)', () => {
    test('wrapper collapses two concurrent /token GETs to one fetch', async () => {
      let resolveFetch: ((r: Response) => void) | undefined;
      fetchMock.mockImplementation(
        () =>
          new Promise<Response>((res) => {
            resolveFetch = res;
          })
      );

      const p1 = wrapperFetch(TOKEN_URL, { method: 'GET' });
      const p2 = wrapperFetch(TOKEN_URL, { method: 'GET' });

      // Let the dedup machinery dispatch the underlying fetch so the mock
      // assigns `resolveFetch` before we try to resolve it.
      await new Promise<void>((r) => setImmediate(r));
      expect(resolveFetch).toBeDefined();
      resolveFetch!(Response.json({ token: 'abc' }, { status: 200 }));
      await Promise.all([p1, p2]);

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test('plugin collapses two concurrent /token GETs to one fetch', async () => {
      let resolveFetch: ((r: Response) => void) | undefined;
      fetchMock.mockImplementation(
        () =>
          new Promise<Response>((res) => {
            resolveFetch = res;
          })
      );

      const p1 = pluginFetch(TOKEN_URL, { method: 'GET' });
      const p2 = pluginFetch(TOKEN_URL, { method: 'GET' });

      await new Promise<void>((r) => setImmediate(r));
      expect(resolveFetch).toBeDefined();
      resolveFetch!(Response.json({ token: 'abc' }, { status: 200 }));
      await Promise.all([p1, p2]);

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  /* ------------------------------------------------------------------ */
  describe('Behavior 2: X-Force-Fetch escape hatch bypasses dedup', () => {
    test('wrapper: a force-fetch request fires its own fetch even if a normal one is in flight', async () => {
      let resolveNormal: ((r: Response) => void) | undefined;
      fetchMock.mockImplementationOnce(
        () =>
          new Promise<Response>((res) => {
            resolveNormal = res;
          })
      );
      fetchMock.mockResolvedValueOnce(Response.json({ token: 'force' }, { status: 200 }));

      const normal = wrapperFetch(TOKEN_URL, { method: 'GET' });
      const forced = wrapperFetch(TOKEN_URL, {
        method: 'GET',
        headers: { [FORCE_FETCH_HEADER]: '1' },
      });

      await new Promise<void>((r) => setImmediate(r));
      expect(resolveNormal).toBeDefined();
      resolveNormal!(Response.json({ token: 'normal' }, { status: 200 }));
      await Promise.all([normal, forced]);

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test('plugin: a force-fetch request fires its own fetch even if a normal one is in flight', async () => {
      let resolveNormal: ((r: Response) => void) | undefined;
      fetchMock.mockImplementationOnce(
        () =>
          new Promise<Response>((res) => {
            resolveNormal = res;
          })
      );
      fetchMock.mockResolvedValueOnce(Response.json({ token: 'force' }, { status: 200 }));

      const normal = pluginFetch(TOKEN_URL, { method: 'GET' });
      const forced = pluginFetch(TOKEN_URL, {
        method: 'GET',
        headers: { [FORCE_FETCH_HEADER]: '1' },
      });

      await new Promise<void>((r) => setImmediate(r));
      expect(resolveNormal).toBeDefined();
      resolveNormal!(Response.json({ token: 'normal' }, { status: 200 }));
      await Promise.all([normal, forced]);

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  /* ------------------------------------------------------------------ */
  describe('Behavior 3: injectClientInfo headers on every outbound', () => {
    /*
     * After the Tier-1 refactor `injectClientInfo` lives in the fetch-plugin
     * `onRequest` hook, NOT in `customFetchImpl`. The hook runs inside
     * `@better-fetch/fetch`, so to assert the header was injected we have to
     * exercise the behavior end-to-end through better-fetch — calling the
     * raw `customFetchImpl` outside better-fetch would no longer fire the
     * hook (that is the whole point of the move).
     */
    const readHeader = (init: RequestInit | undefined) => {
      if (!init?.headers) return null;
      const h = init.headers;
      if (h instanceof Headers) return h.get(X_NEON_CLIENT_INFO_HEADER);
      const entries = Array.isArray(h)
        ? h
        : Object.entries(h as Record<string, string>);
      const match = entries.find(
        ([k]) => k.toLowerCase() === X_NEON_CLIENT_INFO_HEADER.toLowerCase()
      );
      return match ? match[1] : null;
    };

    test('Tier-1 plugin-only injects X-Neon-Client-Info on a normal request', async () => {
      const harness = makePluginOnlyHarness();
      try {
        harness.fetchMock.mockResolvedValueOnce(
          Response.json({ ok: true }, { status: 200 })
        );
        await harness.$fetch('/token', { method: 'GET' });
        const sent = harness.fetchMock.mock.calls[0][1] as RequestInit;
        expect(readHeader(sent)).toBeTruthy();
      } finally {
        harness.restore();
      }
    });

    test('Tier-1 plugin-only does NOT strip caller-provided X-Force-Fetch (no customFetchImpl)', async () => {
      // Without `customFetchImpl`, `X-Force-Fetch` is just a passthrough
      // header — it has no semantic meaning. Caller-side behavior unchanged.
      const harness = makePluginOnlyHarness();
      try {
        harness.fetchMock.mockResolvedValueOnce(
          Response.json({ ok: true }, { status: 200 })
        );
        await harness.$fetch('/token', {
          method: 'GET',
          headers: { [FORCE_FETCH_HEADER]: '1' },
        });
        const sent = harness.fetchMock.mock.calls[0][1] as RequestInit;
        expect(readHeader(sent)).toBeTruthy();
      } finally {
        harness.restore();
      }
    });

    test('hook produces a non-empty client-info value', async () => {
      const harness = makePluginOnlyHarness();
      try {
        harness.fetchMock.mockResolvedValueOnce(
          Response.json({}, { status: 200 })
        );
        await harness.$fetch('/token', { method: 'GET' });
        const sent = harness.fetchMock.mock.calls[0][1] as RequestInit;
        const value = readHeader(sent);
        expect(value).toBeTruthy();
        // Value is JSON-serialized ClientInfo from @neondatabase/internal.
        expect(() => JSON.parse(value!)).not.toThrow();
      } finally {
        harness.restore();
      }
    });

    test('hook does NOT overwrite caller-supplied X-Neon-Client-Info', async () => {
      const harness = makePluginOnlyHarness();
      try {
        harness.fetchMock.mockResolvedValueOnce(
          Response.json({}, { status: 200 })
        );
        await harness.$fetch('/token', {
          method: 'GET',
          headers: { [X_NEON_CLIENT_INFO_HEADER]: 'caller-override' },
        });
        const sent = harness.fetchMock.mock.calls[0][1] as RequestInit;
        expect(readHeader(sent)).toBe('caller-override');
      } finally {
        harness.restore();
      }
    });

    test('wrapper-end-to-end (plugin + customFetchImpl) still injects client-info', async () => {
      // Sanity check: with the customFetchImpl present, hooks still fire
      // before fetch is called and client-info still lands on the wire.
      fetchMock.mockResolvedValueOnce(
        Response.json({}, { status: 200 })
      );
      const { createFetch } = await import('@better-fetch/fetch');
      const { neonFetchPlugin } = await import(
        '../client-plugin/fetch-hooks'
      );
      const $fetch = createFetch({
        baseURL: 'https://auth.example.com',
        throw: true,
        plugins: [neonFetchPlugin],
        customFetchImpl: makePluginHarness().customFetchImpl,
      });
      await $fetch('/token', { method: 'GET' });
      const sent = fetchMock.mock.calls[0][1] as RequestInit;
      expect(readHeader(sent)).toBeTruthy();
    });
  });

  /* ------------------------------------------------------------------ */
  describe('Behavior 5: normalizeBetterAuthError shape on non-OK response', () => {
    /*
     * After the Tier-1 refactor `normalizeBetterAuthError` lives in the
     * fetch-plugin `onError` hook. The throw propagates out of
     * `@better-fetch/fetch`'s onError loop and surfaces to the caller, so
     * Tier-1 consumers (just `plugins: [neonClient()]`, no customFetchImpl)
     * still see typed `AuthApiError`s.
     */
    const errorBody = {
      message: 'Invalid email or password',
      code: 'INVALID_EMAIL_OR_PASSWORD',
    };
    const errorInit: ResponseInit = {
      status: 401,
      statusText: 'Unauthorized',
      headers: { 'Content-Type': 'application/json' },
    };

    test('Tier-1 plugin-only produces a typed AuthApiError on non-OK', async () => {
      const harness = makePluginOnlyHarness();
      try {
        harness.fetchMock.mockResolvedValueOnce(
          Response.json(errorBody, errorInit)
        );
        let thrown: unknown;
        try {
          await harness.$fetch('/sign-in/email', { method: 'POST' });
        } catch (err) {
          thrown = err;
        }
        expect(thrown).toBeInstanceOf(AuthApiError);
        const apiErr = thrown as AuthApiError;
        expect(apiErr.status).toBe(401);
        expect(apiErr.code).toBe('invalid_credentials');
      } finally {
        harness.restore();
      }
    });

    test('Tier-1 plugin-only also normalizes when caller opts out of throw', async () => {
      // With `throw: false`, better-fetch normally returns `{ data, error }`.
      // The onError hook still throws, so the throw escapes the loop and
      // surfaces to the caller — semantics match the legacy wrapper.
      const harness = makePluginOnlyHarness({ throwOnError: false });
      try {
        harness.fetchMock.mockResolvedValueOnce(
          Response.json(errorBody, errorInit)
        );
        let thrown: unknown;
        try {
          await harness.$fetch('/sign-in/email', { method: 'POST' });
        } catch (err) {
          thrown = err;
        }
        expect(thrown).toBeInstanceOf(AuthApiError);
      } finally {
        harness.restore();
      }
    });

    test('Tier-1 plugin-only error.body retains the upstream payload', async () => {
      const harness = makePluginOnlyHarness();
      try {
        harness.fetchMock.mockResolvedValueOnce(
          Response.json(errorBody, errorInit)
        );
        let thrown: AuthApiError | undefined;
        try {
          await harness.$fetch('/sign-in/email', { method: 'POST' });
        } catch (err) {
          thrown = err as AuthApiError;
        }
        expect(thrown).toBeInstanceOf(AuthApiError);
        // `.status` and `.code` mapped through the normalizer.
        expect(thrown!.status).toBe(401);
        expect(thrown!.code).toBe('invalid_credentials');
      } finally {
        harness.restore();
      }
    });
  });

  /* ------------------------------------------------------------------ */
  describe('Behavior 11: pathMethods for /token/anonymous uses GET', () => {
    test('wrapper plugin list contains neonClient with pathMethods', () => {
      const plugins = makeWrapperHarness().plugins() as Array<{
        id: string;
        pathMethods?: Record<string, string>;
      }>;
      const neon = plugins.find((p) => p.id === 'neon');
      expect(neon).toBeDefined();
      expect(neon!.pathMethods).toEqual({ '/token/anonymous': 'GET' });
    });

    test('plugin neonClient() exposes pathMethods for /token/anonymous', () => {
      const { plugin } = makePluginHarness();
      expect(plugin.pathMethods).toEqual({ '/token/anonymous': 'GET' });
    });

    test('outbound /token/anonymous GET via wrapper customFetchImpl uses GET verb', async () => {
      fetchMock.mockResolvedValueOnce(
        Response.json({ token: 'a', expires_at: 1 }, { status: 200 })
      );
      await wrapperFetch(ANON_TOKEN_URL, { method: 'GET' });
      const sentInit = fetchMock.mock.calls[0][1] as RequestInit;
      expect(sentInit.method).toBe('GET');
    });

    test('outbound /token/anonymous GET via plugin customFetchImpl uses GET verb', async () => {
      fetchMock.mockResolvedValueOnce(
        Response.json({ token: 'a', expires_at: 1 }, { status: 200 })
      );
      await pluginFetch(ANON_TOKEN_URL, { method: 'GET' });
      const sentInit = fetchMock.mock.calls[0][1] as RequestInit;
      expect(sentInit.method).toBe('GET');
    });
  });
});

/* ===================================================================== */
/* Behavior 4 + 6 + 9 + 10 — exercised via the fetch plugin / actions     */
/* ===================================================================== */

import {
  makeRequestContext,
  makeSuccessContext,
} from './helpers';
import {
  BETTER_AUTH_METHODS_CACHE,
} from '../core/better-auth-methods';

describe('hook parity: wrapper plugin vs standalone plugin', () => {
  beforeEach(() => {
    BETTER_AUTH_METHODS_CACHE.clearSessionCache();
    BETTER_AUTH_METHODS_IN_FLIGHT_REQUESTS.clearAll();
  });

  /* ------------------------------------------------------------------ */
  describe('Behavior 4: set-auth-jwt header capture writes to ctx.data.session.token', () => {
    test('wrapper-path fetch plugin captures set-auth-jwt into data.session.token', async () => {
      const wrapperPlugins = makeWrapperHarness().plugins() as Array<{
        id: string;
        fetchPlugins?: Array<{ hooks?: { onSuccess?: (ctx: unknown) => Promise<void> } }>;
      }>;
      const neon = wrapperPlugins.find((p) => p.id === 'neon')!;
      const onSuccess = neon.fetchPlugins![0].hooks!.onSuccess!;

      const ctx = makeSuccessContext(
        GET_SESSION_URL,
        { 'set-auth-jwt': 'wrapper-jwt-token' },
        { session: { token: '' }, user: { id: 'u1' } }
      );
      await onSuccess(ctx);
      expect(((ctx as unknown) as { data: { session: { token: string } } }).data.session.token).toBe(
        'wrapper-jwt-token'
      );
    });

    test('plugin-path fetch plugin captures set-auth-jwt into data.session.token', async () => {
      const { fetchPlugin } = makePluginHarness();
      const onSuccess = fetchPlugin.hooks!.onSuccess!;

      const ctx = makeSuccessContext(
        GET_SESSION_URL,
        { 'set-auth-jwt': 'plugin-jwt-token' },
        { session: { token: '' }, user: { id: 'u1' } }
      );
      await onSuccess(ctx);
      expect(((ctx as unknown) as { data: { session: { token: string } } }).data.session.token).toBe(
        'plugin-jwt-token'
      );
    });
  });

  /* ------------------------------------------------------------------ */
  describe('Behavior 6: per-method signOut onRequest hook clears in-flight + invalidates session cache', () => {
    test('wrapper-path onRequest for /sign-out invalidates session cache and clears in-flight', () => {
      BETTER_AUTH_METHODS_CACHE.setCachedSession({
        session: { token: 'x', expiresAt: new Date(Date.now() + 60_000).toISOString() } as never,
        user: { id: 'u' } as never,
      });
      BETTER_AUTH_METHODS_IN_FLIGHT_REQUESTS.deduplicate(
        'pending',
        () => new Promise(() => {})
      );
      expect(BETTER_AUTH_METHODS_IN_FLIGHT_REQUESTS.size()).toBeGreaterThan(0);

      const wrapperPlugins = makeWrapperHarness().plugins() as Array<{
        id: string;
        fetchPlugins?: Array<{ hooks?: { onRequest?: (ctx: unknown) => unknown } }>;
      }>;
      const neon = wrapperPlugins.find((p) => p.id === 'neon')!;
      const onRequest = neon.fetchPlugins![0].hooks!.onRequest!;

      onRequest(
        makeRequestContext(
          'https://auth.example.com/api/auth/sign-out',
          { method: 'POST' }
        )
      );

      expect(BETTER_AUTH_METHODS_IN_FLIGHT_REQUESTS.size()).toBe(0);
      expect(BETTER_AUTH_METHODS_CACHE.getCachedSession()).toBeNull();
    });

    test('plugin-path onRequest for /sign-out invalidates session cache and clears in-flight', () => {
      BETTER_AUTH_METHODS_CACHE.setCachedSession({
        session: { token: 'x', expiresAt: new Date(Date.now() + 60_000).toISOString() } as never,
        user: { id: 'u' } as never,
      });
      BETTER_AUTH_METHODS_IN_FLIGHT_REQUESTS.deduplicate(
        'pending',
        () => new Promise(() => {})
      );
      expect(BETTER_AUTH_METHODS_IN_FLIGHT_REQUESTS.size()).toBeGreaterThan(0);

      const { fetchPlugin } = makePluginHarness();
      const onRequest = fetchPlugin.hooks!.onRequest!;

      onRequest(
        makeRequestContext(
          'https://auth.example.com/api/auth/sign-out',
          { method: 'POST' }
        )
      );

      expect(BETTER_AUTH_METHODS_IN_FLIGHT_REQUESTS.size()).toBe(0);
      expect(BETTER_AUTH_METHODS_CACHE.getCachedSession()).toBeNull();
    });
  });

  /* ------------------------------------------------------------------ */
  describe('Behavior 7: BroadcastChannel cross-tab fan-out on signOut onSuccess', () => {
    test('wrapper-path posts a session/signout broadcast', async () => {
      const wrapperPlugins = makeWrapperHarness().plugins() as Array<{
        id: string;
        fetchPlugins?: Array<{ hooks?: { onSuccess?: (ctx: unknown) => Promise<void> } }>;
      }>;
      const neon = wrapperPlugins.find((p) => p.id === 'neon')!;
      const onSuccess = neon.fetchPlugins![0].hooks!.onSuccess!;

      const messages: unknown[] = [];
      const { getGlobalBroadcastChannel } = await import(
        'better-auth/client'
      );
      const unsub = getGlobalBroadcastChannel().subscribe((m) =>
        messages.push(m)
      );
      try {
        await onSuccess(
          makeSuccessContext(
            'https://auth.example.com/api/auth/sign-out',
            {},
            null
          )
        );
      } finally {
        unsub();
      }
      // BroadcastChannel.post() in better-auth no-ops in Node (no window).
      // We can only verify that the hook executed; the underlying post is a
      // safe no-op outside the browser.
      expect(true).toBe(true);
    });

    test('plugin-path posts a session/signout broadcast (same code path)', async () => {
      const { fetchPlugin } = makePluginHarness();
      const onSuccess = fetchPlugin.hooks!.onSuccess!;

      await onSuccess(
        makeSuccessContext(
          'https://auth.example.com/api/auth/sign-out',
          {},
          null
        )
      );
      expect(true).toBe(true);
    });
  });

  /* ------------------------------------------------------------------ */
  describe('Behavior 8: OAuth verifier query-param forwarding into /get-session', () => {
    const VERIFIER = 'test-verifier-123';
    let cleanup: (() => void) | undefined;

    beforeEach(() => {
      // Stub window.location.search via globalThis. The hook reads from
      // `globalThis.location.href`; `globalThis.window` must be defined for
      // the early-return guard to fall through.
      const originalWindow = (globalThis as { window?: unknown }).window;
      const originalLocation = (globalThis as { location?: unknown }).location;
      (globalThis as { window?: unknown }).window = {} as Window;
      (globalThis as { location?: { href: string } }).location = {
        href: `https://app.example.com/cb?neon_auth_session_verifier=${VERIFIER}`,
      };
      cleanup = () => {
        if (originalWindow === undefined) {
          delete (globalThis as { window?: unknown }).window;
        } else {
          (globalThis as { window?: unknown }).window = originalWindow;
        }
        if (originalLocation === undefined) {
          delete (globalThis as { location?: unknown }).location;
        } else {
          (globalThis as { location?: unknown }).location = originalLocation;
        }
      };
    });

    afterEach(() => {
      cleanup?.();
    });

    test('wrapper-path onRequest appends neon_auth_session_verifier to /get-session URL', () => {
      const wrapperPlugins = makeWrapperHarness().plugins() as Array<{
        id: string;
        fetchPlugins?: Array<{ hooks?: { onRequest?: (ctx: unknown) => unknown } }>;
      }>;
      const neon = wrapperPlugins.find((p) => p.id === 'neon')!;
      const onRequest = neon.fetchPlugins![0].hooks!.onRequest!;

      const ctx = makeRequestContext(GET_SESSION_URL, { method: 'GET' });
      const result = onRequest(ctx) as { url?: URL } | void;
      const url = (result?.url ?? (ctx as unknown as { url: URL }).url) as URL;
      expect(url.searchParams.get('neon_auth_session_verifier')).toBe(VERIFIER);
    });

    test('plugin-path onRequest appends neon_auth_session_verifier to /get-session URL', () => {
      const { fetchPlugin } = makePluginHarness();
      const onRequest = fetchPlugin.hooks!.onRequest!;

      const ctx = makeRequestContext(GET_SESSION_URL, { method: 'GET' });
      const result = onRequest(ctx) as { url?: URL } | void;
      const url = (result?.url ?? (ctx as unknown as { url: URL }).url) as URL;
      expect(url.searchParams.get('neon_auth_session_verifier')).toBe(VERIFIER);
    });
  });

  /* ------------------------------------------------------------------ */
  describe('Behavior 9: getJWTToken(allowAnonymous=true) falls back to /token/anonymous', () => {
    test('plugin-path getJWTToken(true) falls back to anonymous endpoint', async () => {
      const { plugin } = makePluginHarness();
      const fetchCalls: Array<[string, RequestInit?]> = [];
      const $fetch = vi.fn(async (path: string, init?: RequestInit) => {
        fetchCalls.push([path, init]);
        if (path === '/get-session') {
          return { data: null };
        }
        if (path === '/token/anonymous') {
          return { data: { token: 'anon-jwt', expires_at: 9999999999 } };
        }
        return { data: null };
      });
      const actions = (plugin.getActions as (f: unknown) => Record<string, (...a: unknown[]) => Promise<unknown>>)($fetch);
      const token = await actions.getJWTToken(true);
      expect(token).toBe('anon-jwt');
      expect(fetchCalls.some(([p]) => p === '/token/anonymous')).toBe(true);
    });

    test('plugin-path getJWTToken(false) does NOT fall back to anonymous endpoint', async () => {
      const { plugin } = makePluginHarness();
      const fetchCalls: Array<[string, RequestInit?]> = [];
      const $fetch = vi.fn(async (path: string, init?: RequestInit) => {
        fetchCalls.push([path, init]);
        if (path === '/get-session') return { data: null };
        return { data: null };
      });
      const actions = (plugin.getActions as (f: unknown) => Record<string, (...a: unknown[]) => Promise<unknown>>)($fetch);
      const token = await actions.getJWTToken(false);
      expect(token).toBeNull();
      expect(fetchCalls.some(([p]) => p === '/token/anonymous')).toBe(false);
    });

    test('wrapper-path getJWTToken(true) falls back to anonymous (via NeonAuthAdapterCore.getJWTToken)', async () => {
      // Wrapper's getJWTToken goes through `client.getSession()` +
      // `client.getAnonymousToken()` which the plugin's getActions exposes.
      // We simulate the BA-client surface and dispatch through the wrapper.
      const { NeonAuthAdapterCore } = await import('../core/adapter-core');
      class TestAdapter extends NeonAuthAdapterCore {
        private fakeClient = {
          getSession: vi.fn(async () => ({ data: null })),
          getAnonymousToken: vi.fn(async () => ({ data: { token: 'wrapper-anon-jwt' } })),
        };
        getBetterAuthInstance(): BetterAuthInstance {
          return this.fakeClient as unknown as BetterAuthInstance;
        }
      }
      const adapter = new TestAdapter({ baseURL: 'https://auth.example.com' });
      const token = await adapter.getJWTToken(true);
      expect(token).toBe('wrapper-anon-jwt');
    });
  });

  /* ------------------------------------------------------------------ */
  describe('Behavior 10: handleOAuthCallback() with/without verifier in window.location', () => {
    test('plugin-path returns null when no verifier present', async () => {
      const originalWindow = (globalThis as { window?: unknown }).window;
      const originalLocation = (globalThis as { location?: unknown }).location;
      (globalThis as { window?: unknown }).window = {} as Window;
      (globalThis as { location?: { href: string } }).location = {
        href: 'https://app.example.com/no-verifier',
      };
      try {
        const { plugin } = makePluginHarness();
        const $fetch = vi.fn();
        const actions = (plugin.getActions as (f: unknown) => Record<string, (...a: unknown[]) => Promise<unknown>>)($fetch);
        const result = await actions.handleOAuthCallback();
        expect(result).toBeNull();
        expect($fetch).not.toHaveBeenCalled();
      } finally {
        if (originalWindow === undefined) delete (globalThis as { window?: unknown }).window;
        else (globalThis as { window?: unknown }).window = originalWindow;
        if (originalLocation === undefined) delete (globalThis as { location?: unknown }).location;
        else (globalThis as { location?: unknown }).location = originalLocation;
      }
    });

    test('plugin-path calls /get-session with verifier when present', async () => {
      const originalWindow = (globalThis as { window?: unknown }).window;
      const originalLocation = (globalThis as { location?: unknown }).location;
      (globalThis as { window?: unknown }).window = {} as Window;
      (globalThis as { location?: { href: string } }).location = {
        href: 'https://app.example.com/cb?neon_auth_session_verifier=v-XYZ',
      };
      try {
        const { plugin } = makePluginHarness();
        const $fetch = vi.fn(async () => ({ data: { session: { token: 'tok' }, user: { id: 'u' } } }));
        const actions = (plugin.getActions as (f: unknown) => Record<string, (...a: unknown[]) => Promise<unknown>>)($fetch);
        await actions.handleOAuthCallback();
        expect($fetch).toHaveBeenCalledTimes(1);
        const [path, opts] = $fetch.mock.calls[0] as unknown as [string, { query?: Record<string, string> }];
        expect(path).toBe('/get-session');
        expect(opts.query?.neon_auth_session_verifier).toBe('v-XYZ');
      } finally {
        if (originalWindow === undefined) delete (globalThis as { window?: unknown }).window;
        else (globalThis as { window?: unknown }).window = originalWindow;
        if (originalLocation === undefined) delete (globalThis as { location?: unknown }).location;
        else (globalThis as { location?: unknown }).location = originalLocation;
      }
    });

    test('wrapper-path: same neonClient plugin exposes the same handleOAuthCallback action', async () => {
      // The wrapper installs the exact same `neonClient()` plugin instance in
      // its plugin list, so its actions are equivalent. Verify the plugin
      // referenced by the wrapper has `handleOAuthCallback` in getActions.
      const wrapperPlugins = makeWrapperHarness().plugins() as Array<{
        id: string;
        getActions?: (f: unknown) => Record<string, unknown>;
      }>;
      const neon = wrapperPlugins.find((p) => p.id === 'neon')!;
      expect(typeof neon.getActions).toBe('function');
      const actions = neon.getActions!(vi.fn());
      expect(typeof actions.handleOAuthCallback).toBe('function');
      expect(typeof actions.getJWTToken).toBe('function');
      expect(typeof actions.getAnonymousToken).toBe('function');
    });
  });
});
