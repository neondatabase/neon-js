import { describe, expect, test, vi } from 'vitest';
import { BETTER_AUTH_VERSION } from '@neondatabase/auth';

// Simulates a published postgrest-js whose getClientInfo predates the
// `extras` argument; neon-js's header must not depend on it.
vi.mock('@neondatabase/postgrest-js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@neondatabase/postgrest-js')>();
  return {
    ...actual,
    getClientInfo: (sdkName: string, sdkVersion: string) =>
      actual.getClientInfo(sdkName, sdkVersion),
  };
});

describe('buildNeonJsClientInfo with an older postgrest-js installed', () => {
  test('still carries betterAuthVersion', async () => {
    const { buildNeonJsClientInfo } = await import('./client-info');
    const info = JSON.parse(buildNeonJsClientInfo());

    expect(info.sdk).toBe('@neondatabase/neon-js');
    expect(info.betterAuthVersion).toBe(BETTER_AUTH_VERSION);
    expect(info.betterAuthVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
