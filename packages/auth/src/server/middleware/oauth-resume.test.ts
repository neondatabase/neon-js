import { afterEach, describe, expect, test, vi } from 'vitest';
import { oauthProviderClient } from '@better-auth/oauth-provider/client';
import { buildSignedOAuthQuery } from './oauth-resume';

async function clientOAuthQuery(search: string): Promise<string | undefined> {
  vi.stubGlobal('window', { location: { search } });
  const plugin = oauthProviderClient();
  const hook = plugin.fetchPlugins[0].hooks.onRequest as unknown as (ctx: {
    headers: Headers;
    method: string;
    body?: string;
  }) => Promise<void>;
  const ctx: { headers: Headers; method: string; body?: string } = {
    headers: new Headers({ 'content-type': 'application/json' }),
    method: 'POST',
    body: '{}',
  };
  await hook(ctx);
  return JSON.parse(ctx.body ?? '{}').oauth_query;
}

describe('buildSignedOAuthQuery parity with oauthProviderClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const fixtures: Record<string, string> = {
    'repeated ba_param':
      '?client_id=c&sig=abc&ba_param=client_id&ba_param=scope&ba_param=ba_param&scope=openid',
    'interleaved unsigned params':
      '?utm=1&client_id=c&track=2&scope=openid&sig=abc&ba_param=client_id&ba_param=scope&ba_param=ba_param&x=y',
    'scope with spaces':
      '?scope=openid%20profile%20email&client_id=c&sig=abc&ba_param=client_id&ba_param=scope&ba_param=ba_param',
    'scope with plus':
      '?scope=openid+profile&client_id=c&sig=abc&ba_param=client_id&ba_param=scope&ba_param=ba_param',
    'repeated resource':
      '?resource=https%3A%2F%2Fa.example&resource=https%3A%2F%2Fb.example&sig=abc&ba_param=resource&ba_param=ba_param',
    'claims json':
      `?claims=${encodeURIComponent('{"id_token":{"email":null}}')}&sig=abc&ba_param=claims&ba_param=ba_param`,
    'percent-encoding':
      '?redirect_uri=https%3A%2F%2Frp.example%2Fcb%3Fa%3Db%26c%3Dd&sig=a%2Bb%3D&ba_param=redirect_uri&ba_param=ba_param',
    'unsigned name repeated as unsigned':
      '?client_id=c&client_id=d&sig=abc&ba_param=client_id&ba_param=ba_param',
  };

  test.each(Object.entries(fixtures))('%s', async (_name, search) => {
    const expected = await clientOAuthQuery(search);
    expect(expected).toBeTypeOf('string');
    expect(buildSignedOAuthQuery(search)).toBe(expected);
  });

  const unsigned: Record<string, string> = {
    'no sig': '?client_id=c&ba_param=client_id',
    'no ba_param': '?client_id=c&sig=abc',
    empty: '',
  };

  test.each(Object.entries(unsigned))('returns undefined like the client: %s', async (_name, search) => {
    expect(await clientOAuthQuery(search)).toBeUndefined();
    expect(buildSignedOAuthQuery(search)).toBeUndefined();
  });
});
