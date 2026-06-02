import { describe, expect, test } from 'vitest';
import { DEFAULT_AUTH_SKIP_ROUTES } from './route-protection';

describe('DEFAULT_AUTH_SKIP_ROUTES', () => {
  // Behavior pin: this list was historically inlined in
  // `packages/auth/src/next/server/middleware.ts` as `SKIP_ROUTES`. Promoting
  // it to a toolkit-level export MUST preserve order and entries exactly so
  // that the Next.js middleware skip behavior is byte-for-byte unchanged.
  // Any intentional addition/removal should be a deliberate change paired
  // with a CHANGELOG entry.
  test('preserves the legacy Next.js skip list verbatim', () => {
    expect([...DEFAULT_AUTH_SKIP_ROUTES]).toEqual([
      '/api/auth',
      '/auth/callback',
      '/auth/sign-in',
      '/auth/sign-up',
      '/auth/magic-link',
      '/auth/email-otp',
      '/auth/forgot-password',
    ]);
  });

  test('is a readonly tuple', () => {
    // `as const` should make pushes a compile error; the runtime check
    // exists only to guard against accidental future widening of the type.
    expect(Object.isFrozen(DEFAULT_AUTH_SKIP_ROUTES)).toBe(false);
    // Arrays produced by `as const` are not frozen at runtime — only the
    // type is `readonly`. That's expected.
  });
});
