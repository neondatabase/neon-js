import { afterEach, describe, expect, test, vi } from 'vitest';
import { oauthProviderClient } from '@better-auth/oauth-provider/client';
import {
  buildOAuthQuery,
  getPrompts,
  mapOAuth2ResumeResponse,
  prepareOAuth2Resume,
} from './oauth2-resume';

const SIGNED =
  'response_type=code&client_id=c1&prompt=consent&utm_source=ad&exp=1&sig=abc' +
  '&ba_param=client_id&ba_param=exp&ba_param=prompt&ba_param=response_type&ba_param=sig&ba_param=ba_param';

describe('buildOAuthQuery', () => {
  test('keeps sig, ba_param and the params ba_param names, in URL order', () => {
    const out = buildOAuthQuery(SIGNED);
    expect(out).toBeDefined();
    const params = new URLSearchParams(out);
    expect(params.has('utm_source')).toBe(false);
    expect(out!.split('&').map((p) => p.split('=')[0])).toEqual([
      'response_type',
      'client_id',
      'prompt',
      'exp',
      'sig',
      'ba_param',
      'ba_param',
      'ba_param',
      'ba_param',
      'ba_param',
      'ba_param',
    ]);
  });

  test('is order-preserving when the page query is reordered', () => {
    const out = buildOAuthQuery(
      'sig=abc&ba_param=sig&ba_param=ba_param&ba_param=client_id&client_id=c1&noise=1'
    );
    expect(out).toBe(
      'sig=abc&ba_param=sig&ba_param=ba_param&ba_param=client_id&client_id=c1'
    );
  });

  test('accepts a leading ?, URLSearchParams and a Next-style record', () => {
    const expected = buildOAuthQuery(SIGNED);
    expect(buildOAuthQuery(`?${SIGNED}`)).toBe(expected);
    expect(buildOAuthQuery(new URLSearchParams(SIGNED))).toBe(expected);
    const record: Record<string, string | string[]> = {};
    for (const [k, v] of new URLSearchParams(SIGNED)) {
      const prev = record[k];
      record[k] = prev === undefined ? v : [prev, v].flat();
    }
    const fromRecord = buildOAuthQuery(record);
    expect([...new URLSearchParams(fromRecord).entries()].toSorted()).toEqual(
      [...new URLSearchParams(expected).entries()].toSorted()
    );
  });

  test('returns undefined without sig or without ba_param', () => {
    expect(buildOAuthQuery('client_id=c1')).toBeUndefined();
    expect(buildOAuthQuery('sig=abc&client_id=c1')).toBeUndefined();
    expect(buildOAuthQuery('ba_param=sig&client_id=c1')).toBeUndefined();
    expect(buildOAuthQuery('')).toBeUndefined();
  });

  describe('matches the oauth-provider client plugin', () => {
    afterEach(() => vi.unstubAllGlobals());

    const pluginResult = async (search: string) => {
      vi.stubGlobal('window', { location: { search } });
      const plugin = oauthProviderClient().fetchPlugins[0]!;
      const ctx = {
        headers: new Headers({ 'content-type': 'application/json' }),
        method: 'POST',
        body: JSON.stringify({ selected: true }),
      };
      await plugin.hooks!.onRequest!(ctx as never);
      return (JSON.parse(ctx.body) as { oauth_query?: string }).oauth_query;
    };

    test.each([
      ['full signed query', `?${SIGNED}`],
      [
        'reordered with noise',
        '?z=1&sig=abc&utm=x&ba_param=sig&ba_param=ba_param&ba_param=a&a=1&a=2',
      ],
      [
        'encoded values',
        '?sig=a%2Bb&ba_param=sig&ba_param=ba_param&ba_param=q&q=x%20y',
      ],
    ])('%s', async (_name, search) => {
      expect(buildOAuthQuery(search)).toBe(await pluginResult(search));
    });
  });
});

describe('getPrompts', () => {
  test.each([
    ['prompt=login', ['login']],
    ['prompt=create', ['create']],
    ['prompt=consent%20login', ['consent', 'login']],
    ['prompt=consent+login', ['consent', 'login']],
    ['prompt=none', ['none']],
    ['client_id=c1', []],
  ])('%s', (query, expected) => {
    expect(getPrompts(query)).toEqual(expected);
  });
});

describe('prepareOAuth2Resume', () => {
  const UNPROMPTED =
    'response_type=code&client_id=c1&utm_source=ad&exp=1&sig=abc' +
    '&ba_param=client_id&ba_param=exp&ba_param=response_type&ba_param=sig&ba_param=ba_param';
  const withPrompt = (prompt: string) =>
    `${UNPROMPTED}&prompt=${encodeURIComponent(prompt)}&ba_param=prompt`;

  test('returns not_oauth without a signed query', () => {
    expect(prepareOAuth2Resume('client_id=c1')).toEqual({
      result: { status: 'not_oauth' },
    });
  });

  test.each(['login', 'create', 'consent login', 'create consent'])(
    'prompt=%s requires a login',
    (prompt) => {
      expect(prepareOAuth2Resume(withPrompt(prompt))).toEqual({
        result: { status: 'login_required' },
      });
    }
  );

  test.each(['none', 'consent'])('prompt=%s may resume', (prompt) => {
    const prepared = prepareOAuth2Resume(withPrompt(prompt));
    expect('oauthQuery' in prepared).toBe(true);
  });

  test('a prompt outside the signed set is ignored', () => {
    const prepared = prepareOAuth2Resume(`${UNPROMPTED}&prompt=login`);
    expect(prepared).toEqual({ oauthQuery: buildOAuthQuery(UNPROMPTED) });
  });

  test('resumes a signed query without a prompt', () => {
    expect(prepareOAuth2Resume(UNPROMPTED)).toEqual({
      oauthQuery: buildOAuthQuery(UNPROMPTED),
    });
  });
});

describe('mapOAuth2ResumeResponse', () => {
  const err = (status: number, extra: Record<string, unknown> = {}) => ({
    data: null,
    error: { status, statusText: 'x', ...extra },
  });

  test('redirect', () => {
    expect(
      mapOAuth2ResumeResponse({
        data: { redirect: true, url: 'https://rp.example.com/cb?code=1' },
        error: null,
      })
    ).toEqual({ status: 'redirect', url: 'https://rp.example.com/cb?code=1' });
  });

  test('401 is no_session', () => {
    expect(mapOAuth2ResumeResponse(err(401, { code: 'UNAUTHORIZED' }))).toEqual(
      {
        status: 'no_session',
      }
    );
  });

  test('400 invalid_signature is expired', () => {
    expect(
      mapOAuth2ResumeResponse(err(400, { error: 'invalid_signature' }))
    ).toEqual({ status: 'expired' });
  });

  test('400 without an upstream error code is expired', () => {
    expect(
      mapOAuth2ResumeResponse(err(400, { message: 'Bad Request' }))
    ).toEqual({ status: 'expired' });
  });

  test('400 with a different upstream error is an error', () => {
    expect(
      mapOAuth2ResumeResponse(err(400, { error: 'invalid_request' })).status
    ).toBe('error');
  });

  test('404 is not_oauth', () => {
    expect(mapOAuth2ResumeResponse(err(404))).toEqual({ status: 'not_oauth' });
  });

  test('other failures carry the error', () => {
    const result = mapOAuth2ResumeResponse(err(500, { message: 'boom' }));
    expect(result).toEqual({
      status: 'error',
      error: expect.objectContaining({ status: 500, message: 'boom' }),
    });
  });

  test('a success without a redirect url is an error', () => {
    expect(
      mapOAuth2ResumeResponse({ data: { ok: true }, error: null }).status
    ).toBe('error');
  });
});
