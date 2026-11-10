import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { NeonAuthAdapterCore } from '../core/adapter-core';
import type { BetterAuthInstance } from '../types';
import { BETTER_AUTH_VERSION } from './better-auth-version';

class TestAdapter extends NeonAuthAdapterCore {
  getBetterAuthInstance(): BetterAuthInstance {
    return {} as BetterAuthInstance;
  }

  getCustomFetchImpl() {
    const fetchOptions = this.betterAuthOptions.fetchOptions as {
      customFetchImpl: (
        url: string | URL | Request,
        init?: RequestInit
      ) => Promise<Response>;
    };
    return fetchOptions.customFetchImpl;
  }
}

const here = path.dirname(fileURLToPath(import.meta.url));
const readJson = (relativePath: string) =>
  JSON.parse(readFileSync(path.resolve(here, relativePath), 'utf8')) as Record<
    string,
    any
  >;

// Mirrors the Neon Auth server's SDK classification
// (neon-cloud/neon-auth/src/api/auth/legacy-shim.ts): the version is parsed with
// /^(\d+)\.(\d+)/ and is "modern" only for better-auth >= 1.7. Anything the
// regex rejects (e.g. "^1.7.6", "v1.7.6") is treated as legacy.
function isModernBetterAuth(version?: unknown): boolean {
  if (typeof version !== 'string') return false;
  const m = /^(\d+)\.(\d+)/.exec(version);
  if (!m) return false;
  const major = Number(m[1]);
  const minor = Number(m[2]);
  return major > 1 || (major === 1 && minor >= 7);
}

describe('X-Neon-Client-Info sent by the auth adapter', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  async function captureClientInfo(): Promise<Record<string, unknown>> {
    const adapter = new TestAdapter({ baseURL: 'https://auth.example.com' });
    await adapter.getCustomFetchImpl()(
      'https://auth.example.com/api/auth/get-session'
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const raw = new Headers(init.headers).get('X-Neon-Client-Info');
    expect(raw).toBeTruthy();
    return JSON.parse(raw as string);
  }

  test('identifies the SDK and carries a bare better-auth version', async () => {
    const info = await captureClientInfo();

    expect(info.sdk).toBe('@neondatabase/auth');
    expect(typeof info.betterAuthVersion).toBe('string');
    expect(info.betterAuthVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(info.betterAuthVersion).toBe(BETTER_AUTH_VERSION);
  });

  test('is classified as modern by the server gate', async () => {
    const info = await captureClientInfo();
    expect(isModernBetterAuth(info.betterAuthVersion)).toBe(true);
  });

  test('gate rejects range-prefixed and missing versions', () => {
    expect(isModernBetterAuth('^1.7.6')).toBe(false);
    expect(isModernBetterAuth('~1.7.6')).toBe(false);
    expect(isModernBetterAuth('v1.7.6')).toBe(false);
    expect(isModernBetterAuth()).toBe(false);
    expect(isModernBetterAuth('1.6.23')).toBe(false);
    expect(isModernBetterAuth('1.7.6')).toBe(true);
  });

  test('matches the better-auth version installed on disk', () => {
    // better-auth does not export ./package.json, so read it directly.
    const installed = readJson('../../node_modules/better-auth/package.json');
    expect(BETTER_AUTH_VERSION).toBe(installed.version);
  });

  test('matches the root pnpm override', () => {
    const root = readJson('../../../../package.json');
    expect(BETTER_AUTH_VERSION).toBe(root.pnpm.overrides['better-auth']);
  });
});
