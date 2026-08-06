/**
 * Shared helpers for behavior-parity tests under `__compat__/`.
 *
 * These tests verify that the legacy `BetterAuthVanillaAdapter` wrapper and
 * the standalone `neonClient()` plugin path exhibit identical Neon-specific
 * behavior.
 *
 * Both paths ultimately call into the same shared code under
 * `client-plugin/` + `core/`, so the tests below assert that the surface
 * exposed to consumers (custom fetch impl, fetch-plugin hooks, plugin
 * actions) is wired up identically across three tiers:
 *
 *  - Tier 1 / `makePluginOnlyHarness` — `plugins: [neonClient()]` only.
 *    Exercises onRequest / onError / onSuccess hooks through a real
 *    `@better-fetch/fetch` instance with NO `customFetchImpl`. This is the
 *    minimum config a tenant needs to get client-info injection, error
 *    normalization, JWT capture, verifier forwarding, etc.
 *  - Tier 2 / `makePluginHarness` — adds `createNeonCustomFetchImpl()` for
 *    body-aware dedup + `X-Force-Fetch`.
 *  - Tier 3 / `makeWrapperHarness` — the legacy `NeonAuthAdapterCore` wrapper
 *    which installs Tier 2 plus default `throw: false` envelope shape.
 */
import { createFetch } from '@better-fetch/fetch';
import type { BetterFetch } from '@better-fetch/fetch';
import { vi } from 'vitest';
import { NeonAuthAdapterCore } from '../core/adapter-core';
import {
  createNeonCustomFetchImpl,
  FORCE_FETCH_HEADER,
} from '../client-plugin/custom-fetch';
import { neonClient } from '../client-plugin';
import {
  neonFetchPlugin,
  onRequestHook,
  onSuccessHook,
} from '../client-plugin/fetch-hooks';
import type { BetterAuthInstance } from '../types';

export { FORCE_FETCH_HEADER };

/**
 * Concrete adapter used to grab the wrapper-path `customFetchImpl` for direct
 * exercise without spinning up a full Better Auth client.
 */
export class WrapperHarness extends NeonAuthAdapterCore {
  getBetterAuthInstance(): BetterAuthInstance {
    return {} as BetterAuthInstance;
  }

  /** The wrapper-path `customFetchImpl` (wired by `NeonAuthAdapterCore` ctor). */
  customFetchImpl() {
    const opts = this.betterAuthOptions.fetchOptions as {
      customFetchImpl: (
        url: string | URL | Request,
        init?: RequestInit
      ) => Promise<Response>;
    };
    return opts.customFetchImpl;
  }

  /** The wrapper-path plugin list (must contain `neonClient()`). */
  plugins() {
    return this.betterAuthOptions.plugins;
  }
}

/** Build a wrapper-path harness. */
export function makeWrapperHarness() {
  return new WrapperHarness({ baseURL: 'https://auth.example.com' });
}

/** Standalone-plugin-path artefacts (`neonClient()` + `customFetchImpl`). */
export function makePluginHarness() {
  return {
    plugin: neonClient(),
    customFetchImpl: createNeonCustomFetchImpl(),
    fetchPlugin: neonFetchPlugin,
    onRequestHook,
    onSuccessHook,
  };
}

/**
 * Tier-1 harness: a real `@better-fetch/fetch` instance with ONLY
 * `neonFetchPlugin` installed — no `customFetchImpl`. This is the simplest
 * possible wire-up for a tenant who installs `plugins: [neonClient()]`.
 *
 * Returns the constructed `$fetch` plus the fetchMock so tests can stub
 * upstream responses and assert what better-fetch sent on the wire.
 *
 * Caller-side example:
 * ```ts
 *   const { $fetch, fetchMock } = makePluginOnlyHarness();
 *   fetchMock.mockResolvedValueOnce(Response.json({...}, { status: 401 }));
 *   await expect($fetch(...)).rejects.toBeInstanceOf(AuthApiError);
 * ```
 */
export function makePluginOnlyHarness(opts?: {
  /** Whether better-fetch should throw on non-OK (defaults to true so we can
   *  assert on `rejects.toBeInstanceOf` ergonomically; the hook throws first
   *  anyway, this controls fallback behavior). */
  throwOnError?: boolean;
}): {
  $fetch: BetterFetch;
  fetchMock: ReturnType<typeof vi.fn>;
  restore: () => void;
} {
  const fetchMock = vi.fn();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

  const $fetch = createFetch({
    baseURL: 'https://auth.example.com',
    throw: opts?.throwOnError ?? true,
    plugins: [neonFetchPlugin],
  });

  return {
    $fetch,
    fetchMock,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

/** Minimal fetch RequestContext stub for exercising fetch-plugin hooks. */
export function makeRequestContext(url: string, init?: RequestInit) {
  // The fetch hook receives a `ctx` shaped like @better-fetch RequestContext;
  // we only need fields that the hook itself reads/writes.
  return {
    url: new URL(url),
    method: init?.method ?? 'GET',
    headers: new Headers(init?.headers),
    body: init?.body,
  } as unknown as Parameters<typeof onRequestHook>[0];
}

/** Minimal SuccessContext stub for exercising onSuccess. */
export function makeSuccessContext(
  url: string,
  responseHeaders: Record<string, string>,
  data: unknown
) {
  return {
    request: { url: new URL(url) },
    response: new Response(null, { headers: responseHeaders }),
    data,
  } as unknown as Parameters<typeof onSuccessHook>[0];
}
