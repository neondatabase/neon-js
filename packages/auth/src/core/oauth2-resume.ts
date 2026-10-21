export type OAuth2ResumeError = {
  status: number;
  message?: string;
  statusText?: string;
  code?: string;
};

/**
 * Outcome of `oauth2.resume()`. `redirect` carries the URL the OAuth provider
 * wants the user sent to (consent page or the relying party's `redirect_uri`).
 */
export type OAuth2ResumeResult =
  | { status: 'redirect'; url: string }
  | { status: 'not_oauth' }
  | { status: 'login_required' }
  | { status: 'no_session' }
  | { status: 'expired' }
  | { status: 'error'; error: OAuth2ResumeError };

/** Page query in any shape a browser or server framework hands out. */
export type OAuth2ResumeQuery =
  | URLSearchParams
  | string
  | Record<string, string | string[] | undefined>;

const SIGNATURE_PARAM = 'sig';
const SIGNED_NAMES_PARAM = 'ba_param';
const LOGIN_PROMPTS = new Set(['login', 'create']);

function toSearchParams(query: OAuth2ResumeQuery): URLSearchParams {
  if (typeof query === 'string' || query instanceof URLSearchParams) {
    return new URLSearchParams(query);
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    for (const item of [value].flat()) params.append(key, item);
  }
  return params;
}

/**
 * Selects the signed subset of the page query the way the Better Auth OAuth
 * provider client does (`buildSignedOAuthQuery` in
 * `@better-auth/oauth-provider` `dist/signed-query-*.mjs`, which is not a
 * public export). The server verifies only these params, so unsigned page
 * noise such as `utm_*` must not be forwarded.
 */
export function buildOAuthQuery(query: OAuth2ResumeQuery): string | undefined {
  const params = toSearchParams(query);
  if (!params.has(SIGNATURE_PARAM)) return undefined;
  const signedNames = new Set(params.getAll(SIGNED_NAMES_PARAM));
  if (signedNames.size === 0) return undefined;

  const signed = new URLSearchParams();
  for (const [key, value] of params) {
    if (
      key === SIGNATURE_PARAM ||
      key === SIGNED_NAMES_PARAM ||
      signedNames.has(key)
    ) {
      signed.append(key, value);
    }
  }
  return signed.toString();
}

export function getPrompts(oauthQuery: string): string[] {
  const prompt = new URLSearchParams(oauthQuery).get('prompt');
  return prompt ? prompt.split(/\s+/).filter(Boolean) : [];
}

/**
 * Applies the guards that need no request. `login_required` is the loop guard:
 * for `prompt=login|create` the provider answers a resume with its login page
 * again, so resuming unconditionally would redirect forever.
 */
export function prepareOAuth2Resume(
  query: OAuth2ResumeQuery
): { oauthQuery: string } | { result: OAuth2ResumeResult } {
  const oauthQuery = buildOAuthQuery(query);
  if (!oauthQuery) return { result: { status: 'not_oauth' } };
  if (getPrompts(oauthQuery).some((p) => LOGIN_PROMPTS.has(p))) {
    return { result: { status: 'login_required' } };
  }
  return { oauthQuery };
}

export type OAuth2ContinueResponse = {
  data?: unknown;
  error?: {
    status?: number;
    message?: string;
    statusText?: string;
    code?: string;
    error?: unknown;
  } | null;
};

/**
 * Maps a `/oauth2/continue` response. Both the browser client and the server
 * helpers reduce a failed response to its status and a mapped code, dropping
 * the upstream `invalid_signature` body field, so a 400 without that field is
 * treated as an invalid signature too.
 */
export function mapOAuth2ResumeResponse(
  response: OAuth2ContinueResponse
): OAuth2ResumeResult {
  const { data, error } = response;
  if (error) {
    const status = error.status ?? 0;
    if (status === 401) return { status: 'no_session' };
    if (status === 404) return { status: 'not_oauth' };
    if (
      status === 400 &&
      (error.error === undefined || error.error === 'invalid_signature')
    ) {
      return { status: 'expired' };
    }
    const { message, statusText, code } = error;
    return {
      status: 'error',
      error: { status, message, statusText, code },
    };
  }
  const body = data as { redirect?: unknown; url?: unknown } | null;
  if (body?.redirect && typeof body.url === 'string') {
    return { status: 'redirect', url: body.url };
  }
  return {
    status: 'error',
    error: { status: 200, message: 'Unexpected /oauth2/continue response' },
  };
}
