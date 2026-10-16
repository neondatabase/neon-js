import { afterEach, describe, expect, test, vi } from 'vitest';
import { createAuthClient } from '../../neon-auth';
import {
  BetterAuthExpoAdapter,
  getExpoStorageKey
} from './better-auth-expo-adapter';

describe('BetterAuthExpoAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('creates a React client with namespaced storage', async () => {
    const baseURL = 'https://auth.example.com/branch-a';
    expect(getExpoStorageKey(baseURL)).not.toBe(
      getExpoStorageKey('https://auth.example.com/branch-b')
    );
    expect(() => getExpoStorageKey(baseURL, 'invalid/key')).toThrow(
      'Expo storagePrefix'
    );

    vi.stubGlobal('navigator', { product: 'ReactNative' });
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(null)));
    const getItemAsync = vi.fn(async () => null);

    const auth = createAuthClient(baseURL, {
      adapter: BetterAuthExpoAdapter({
        scheme: 'myapp',
        storagePrefix: 'test',
        storage: {
          deleteItemAsync: vi.fn(async () => {}),
          getItemAsync,
          setItemAsync: vi.fn(async () => {})
        },
        browser: {
          openAuthSessionAsync: vi.fn(async () => ({ type: 'cancel' }))
        }
      })
    });

    expect(typeof auth.signIn.social).toBe('function');
    expect(typeof auth.useSession).toBe('function');
    await auth.getSession();
    expect(getItemAsync).toHaveBeenCalledWith(
      getExpoStorageKey(baseURL, 'test')
    );
  });
});
