import { parseCookies } from 'better-auth/cookies';
import { injectClientInfo } from '@/utils/client-info';
import { API_ENDPOINTS } from '../endpoints';
import { NEON_AUTH_SESSION_COOKIE_NAME } from '../constants';
import { handleAuthProxyRequest } from '../proxy';
import { exchangeOAuthToken, needsSessionVerification } from './oauth';
import type { AuthMiddlewareConfig, MiddlewareResult } from './processor';

const REAUTH_PROMPTS = new Set(['login', 'create', 'select_account']);

/**
 * Signed subset of an authorize redirect's query, in URL order. The provider
 * verifies its signature over exactly these entries. Mirrors
 * `buildSignedOAuthQuery` in `@better-auth/oauth-provider` (not exported).
 */
export function buildSignedOAuthQuery(search: string): string | undefined {
  const params = new URLSearchParams(search);
  const names = new Set(params.getAll('ba_param'));
  if (!params.has('sig') || names.size === 0) return undefined;
  const signed = new URLSearchParams();
  for (const [key, value] of params) {
    if (key === 'sig' || key === 'ba_param' || names.has(key)) signed.append(key, value);
  }
  return signed.toString();
}

type ResumeConfig = Pick<
  AuthMiddlewareConfig,
  'request' | 'baseUrl' | 'cookieSecret' | 'sessionDataTtl' | 'domain' | 'sameSite'
> & {
  requestUrl: URL;
  loginPathname: string;
  log: NonNullable<AuthMiddlewareConfig['log']>;
};

/**
 * Resumes a pending OAuth-provider authorization for a signed-in user on the
 * login page. Returns `null` when ineligible so the login page renders.
 */
export async function resumeOAuthAuthorization(
  config: ResumeConfig
): Promise<MiddlewareResult | null> {
  const { request, requestUrl, loginPathname, baseUrl, cookieSecret, log } = config;
  const { sessionDataTtl, domain, sameSite } = config;
  // Fields are limited to a reason and status: the URL, oauth_query, sig and
  // code are bearer-grade values.
  const note = (reason: string, status?: number, level: 'debug' | 'warn' = 'debug') =>
    log[level]('[neon-auth] OAuth resume', { component: 'middleware', reason, status });
  const trim = (path: string) => (path === '/' ? path : path.replace(/\/+$/, ''));

  // Exact path only: a subpath is a different page, not the provider's loginPage.
  if (request.method !== 'GET' || trim(requestUrl.pathname) !== trim(loginPathname)) {
    return null;
  }
  const oauthQuery = buildSignedOAuthQuery(requestUrl.search);
  if (oauthQuery === undefined) return null;

  // A sign-in just completed here; `sig` stays in the redirect so the next
  // request resumes.
  if (needsSessionVerification(request)) {
    const exchange = await exchangeOAuthToken(
      request, baseUrl, cookieSecret, sessionDataTtl, domain, sameSite, log
    );
    if (exchange) {
      note('verifier_exchanged');
      return { action: 'redirect_oauth', redirectUrl: exchange.redirectUrl, cookies: exchange.cookies };
    }
  }

  const cookie = request.headers.get('cookie') ?? '';
  if (!parseCookies(cookie).has(NEON_AUTH_SESSION_COOKIE_NAME)) {
    note('no_session_cookie');
    return null;
  }
  const prompts = new URLSearchParams(oauthQuery).getAll('prompt').flatMap((v) => v.split(/\s+/));
  if (prompts.some((prompt) => REAUTH_PROMPTS.has(prompt))) {
    note('reauth_prompt');
    return null;
  }

  // Origin is set explicitly because the proxy falls back to Referer, which is
  // the relying party. The page query is deliberately not forwarded.
  const headers = new Headers({
    'content-type': 'application/json',
    origin: requestUrl.origin,
    cookie,
  });
  const userAgent = request.headers.get('user-agent');
  if (userAgent) headers.set('user-agent', userAgent);

  const response = await handleAuthProxyRequest({
    request: new Request(requestUrl.origin + requestUrl.pathname, {
      method: 'POST',
      headers: injectClientInfo(headers),
      // Neon configures no selectAccount/postLogin, so the continue flags behave
      // alike; `selected` only strips prompt=select_account, excluded above.
      body: JSON.stringify({ selected: true, oauth_query: oauthQuery }),
    }),
    path: API_ENDPOINTS.oauth2.continue.path,
    baseUrl, cookieSecret, sessionDataTtl, domain, sameSite, log,
  });
  const cookies = response.headers.getSetCookie();
  const fallback = (reason: string, level: 'debug' | 'warn' = 'debug'): MiddlewareResult => {
    note(reason, response.status, level);
    return { action: 'allow', cookies };
  };

  if (!response.ok) {
    // 401 is no session; 400 is an expired or invalid signature. Anything else
    // points at a misconfigured or unhealthy upstream.
    const expected = response.status === 401 || response.status === 400;
    return fallback('upstream_rejected', expected ? 'debug' : 'warn');
  }
  const body = (await response.json().catch(() => null)) as {
    redirect?: unknown;
    url?: unknown;
  } | null;
  if (!body || body.redirect !== true || typeof body.url !== 'string') {
    return fallback('upstream_no_redirect');
  }
  let target: URL;
  try {
    target = new URL(body.url);
  } catch {
    return fallback('invalid_target', 'warn');
  }
  // No scheme allowlist: native MCP clients redirect to custom schemes. The
  // target is the provider's, never the request's. A same-page target (e.g.
  // max_age) would loop.
  if (target.origin === requestUrl.origin && trim(target.pathname) === trim(requestUrl.pathname)) {
    return fallback('self_redirect', 'warn');
  }
  note('redirecting');
  return { action: 'redirect_oauth', redirectUrl: target, cookies };
}
