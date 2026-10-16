import { afterEach, describe, expect, test, vi } from 'vitest';
import { createClientId } from './client-id';

describe('createClientId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('uses Web Crypto when it is available', () => {
    const randomUUID = vi.fn(() => 'browser-uuid');
    vi.stubGlobal('crypto', { randomUUID });

    expect(createClientId()).toBe('browser-uuid');
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  test('does not require a Web Crypto polyfill', () => {
    vi.stubGlobal('crypto', null);

    const first = createClientId();
    const second = createClientId();

    expect(first).toMatch(/^neon-/);
    expect(second).toMatch(/^neon-/);
    expect(second).not.toBe(first);
  });
});
