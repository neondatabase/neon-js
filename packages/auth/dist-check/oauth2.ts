// Compiled against the built declarations (`@neondatabase/auth` resolves to
// `dist` through the package `exports`), so a type that only works from `src`
// is caught. Requires `pnpm build` first.
import { expectTypeOf } from 'vitest';
import { createAuthClient } from '@neondatabase/auth';
import { createAuthServer } from '@neondatabase/auth/server';
import type { OAuth2ResumeResult } from '@neondatabase/auth';
import type { OAuth2ResumeResult as NextServerResumeResult } from '@neondatabase/auth/next/server';

const client = createAuthClient('https://auth.example.com');
expectTypeOf(client.oauth2).not.toBeAny();
expectTypeOf(client.oauth2).toHaveProperty('consent');
expectTypeOf(client.oauth2).toHaveProperty('publicClient');
expectTypeOf(client.oauth2).toHaveProperty('resume');
expectTypeOf(client.oauth2.resume).returns.resolves.toEqualTypeOf<OAuth2ResumeResult>();
expectTypeOf<NextServerResumeResult>().toEqualTypeOf<OAuth2ResumeResult>();

const server = createAuthServer({
  baseUrl: 'https://auth.example.com',
  context: () => {
    throw new Error('type-only');
  },
  cookieSecret: 'x'.repeat(32),
});
expectTypeOf(server.oauth2).not.toBeAny();
expectTypeOf(server.oauth2).toHaveProperty('consent');
expectTypeOf(server.oauth2).toHaveProperty('continue');
expectTypeOf(server.oauth2).toHaveProperty('publicClientPrelogin');
expectTypeOf(server.oauth2).toHaveProperty('updateConsent');
expectTypeOf(server.oauth2).toHaveProperty('deleteConsent');
expectTypeOf(server.oauth2).toHaveProperty('publicClient');
expectTypeOf(server.oauth2).toHaveProperty('getConsent');
expectTypeOf(server.oauth2).toHaveProperty('getConsents');
expectTypeOf(server.oauth2).toHaveProperty('resume');
expectTypeOf(server.oauth2.resume).returns.resolves.toEqualTypeOf<OAuth2ResumeResult>();
expectTypeOf(server.oauth2).not.toHaveProperty('token');
