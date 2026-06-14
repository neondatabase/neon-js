import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock createInternalNeonAuth so we can capture the URL passed to it
// without touching the network.
const createInternalNeonAuthMock = vi.fn(() => ({
  adapter: { getJWTToken: async () => null },
  getJWTToken: async () => null,
}));

vi.mock('@neondatabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@neondatabase/auth')>();
  return {
    ...actual,
    createInternalNeonAuth: (...args: unknown[]) =>
      createInternalNeonAuthMock(...args),
  };
});

import { createClient } from '../client/client-factory';
import { defaultDeriveNeonUrls } from '../client/derive-urls';

const BASE_URL = 'https://ep-xxx.c-2.us-east-2.aws.neon.build/dbname';
const EXPECTED = defaultDeriveNeonUrls(BASE_URL);

describe('createClient — string form', () => {
  beforeEach(() => {
    createInternalNeonAuthMock.mockClear();
  });

  it('derives auth and Data API URLs from a single base URL', () => {
    const client = createClient(BASE_URL);

    // Auth URL: first arg to createInternalNeonAuth
    expect(createInternalNeonAuthMock).toHaveBeenCalledTimes(1);
    expect(createInternalNeonAuthMock.mock.calls[0]?.[0]).toBe(EXPECTED.auth);

    // Data API URL: stored on the underlying PostgrestClient as `url`
    expect((client as unknown as { url: string }).url).toBe(EXPECTED.dataApi);
  });

  it('lets options.auth.url override the derived auth URL', () => {
    createClient(BASE_URL, {
      auth: { url: 'https://override-auth.example.com' },
    });

    expect(createInternalNeonAuthMock.mock.calls[0]?.[0]).toBe(
      'https://override-auth.example.com'
    );
  });

  it('lets options.dataApi.url override the derived Data API URL', () => {
    const client = createClient(BASE_URL, {
      dataApi: { url: 'https://override-data.example.com/rest/v1' },
    });

    expect((client as unknown as { url: string }).url).toBe(
      'https://override-data.example.com/rest/v1'
    );
  });

  it('uses a custom deriveUrls function when provided', () => {
    const customDerive = vi.fn(() => ({
      auth: 'https://custom-auth.example.com',
      dataApi: 'https://custom-data.example.com/rest/v1',
    }));

    const client = createClient(BASE_URL, { deriveUrls: customDerive });

    expect(customDerive).toHaveBeenCalledWith(BASE_URL);
    expect(createInternalNeonAuthMock.mock.calls[0]?.[0]).toBe(
      'https://custom-auth.example.com'
    );
    expect((client as unknown as { url: string }).url).toBe(
      'https://custom-data.example.com/rest/v1'
    );
  });

  it('forwards allowAnonymous to the auth adapter', () => {
    createClient(BASE_URL, { auth: { allowAnonymous: true } });

    const authConfig = createInternalNeonAuthMock.mock.calls[0]?.[1] as {
      allowAnonymous: boolean;
    };
    expect(authConfig.allowAnonymous).toBe(true);
  });

  it('throws on an invalid base URL (default derivation)', () => {
    expect(() => createClient('https://example.com/db')).toThrow(
      /Invalid Neon base URL/
    );
  });

  it('forwards options.auth.adapter to the auth factory', () => {
    const sentinelAdapter = vi.fn();
    createClient(BASE_URL, {
      auth: { adapter: sentinelAdapter as any },
    });

    const authConfig = createInternalNeonAuthMock.mock.calls[0]?.[1] as {
      adapter: unknown;
    };
    expect(authConfig.adapter).toBe(sentinelAdapter);
  });

  it('defaults allowAnonymous to false when not provided', () => {
    createClient(BASE_URL);

    const authConfig = createInternalNeonAuthMock.mock.calls[0]?.[1] as {
      allowAnonymous: boolean;
    };
    expect(authConfig.allowAnonymous).toBe(false);
  });
});

describe('createClient — object form (backward compat)', () => {
  beforeEach(() => {
    createInternalNeonAuthMock.mockClear();
  });

  it('passes through auth.url and dataApi.url unchanged', () => {
    const client = createClient({
      auth: { url: 'https://auth.example.com' },
      dataApi: { url: 'https://data-api.example.com/rest/v1' },
    });

    expect(createInternalNeonAuthMock.mock.calls[0]?.[0]).toBe(
      'https://auth.example.com'
    );
    expect((client as unknown as { url: string }).url).toBe(
      'https://data-api.example.com/rest/v1'
    );
  });
});
