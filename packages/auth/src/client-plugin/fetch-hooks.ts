import type {
  BetterFetchPlugin,
  ErrorContext,
  RequestContext,
  ResponseContext,
  SuccessContext,
} from '@better-fetch/fetch';
import {
  BETTER_AUTH_METHODS_HOOKS,
  deriveBetterAuthMethodFromUrl,
} from '../core/better-auth-methods';
import { normalizeBetterAuthError } from '../core/better-auth-helpers';
import { injectClientInfo } from '../utils/client-info';

const NEON_AUTH_SESSION_VERIFIER_PARAM_NAME = 'neon_auth_session_verifier';
const GET_SESSION_PATH = '/get-session';

const readVerifierFromWindow = (): string | null => {
  if (typeof globalThis.window === 'undefined') {
    return null;
  }
  try {
    return new URL(globalThis.location.href).searchParams.get(
      NEON_AUTH_SESSION_VERIFIER_PARAM_NAME
    );
  } catch {
    return null;
  }
};

const extractPathname = (raw: string): string => {
  try {
    return new URL(raw, 'http://placeholder.invalid').pathname;
  } catch {
    return raw;
  }
};

const isGetSessionUrl = (url: URL | string): boolean => {
  const pathname = typeof url === 'string' ? extractPathname(url) : url.pathname;
  return pathname.endsWith(GET_SESSION_PATH);
};

/**
 * Mutate `ctx.headers` in place so the Neon `X-Neon-Client-Info` header is on
 * every outbound request. better-fetch always passes a real `Headers` instance
 * by reference, so mutation is sufficient (no need to return a new ctx).
 *
 * `injectClientInfo` returns a fresh `Headers` rather than mutating, so we
 * copy the missing entries back onto the original instance.
 */
const applyClientInfo = (ctx: RequestContext): void => {
  const injected = injectClientInfo(ctx.headers);
  injected.forEach((value, name) => {
    if (!ctx.headers.has(name)) {
      ctx.headers.set(name, value);
    }
  });
};

/**
 * Single onRequest hook used by both the standalone plugin and the wrapper.
 *
 * Combines:
 *  - `injectClientInfo` — Neon identifying headers on every outbound request
 *  - per-method `BETTER_AUTH_METHODS_HOOKS[method].onRequest` (side-effects
 *    like clearing the in-flight cache on sign-out, and the get-session
 *    verifier rewrite)
 *  - OAuth verifier query-param forwarding into outbound `/get-session`
 *    requests so the server can finalize the session
 *
 * Returns a (potentially mutated) RequestContext or void.
 */
export const onRequestHook = (
  ctx: RequestContext
): RequestContext | void => {
  // Inject client-info headers on every outbound. Mutates ctx.headers in
  // place; better-fetch always supplies a real Headers instance.
  applyClientInfo(ctx);

  const urlString = ctx.url.toString();
  const method = deriveBetterAuthMethodFromUrl(urlString);

  let next: RequestContext | void = undefined;
  if (method) {
    const result = BETTER_AUTH_METHODS_HOOKS[method].onRequest(ctx);
    if (result) {
      next = result;
      ctx = result;
    }
  }

  // OAuth verifier forwarding. The per-method get-session hook already does
  // this, but we also run it for standalone-plugin consumers who land on a
  // path that does not match deriveBetterAuthMethodFromUrl (e.g. custom
  // session-fetch endpoints that still end in /get-session).
  const verifier = readVerifierFromWindow();
  if (verifier && isGetSessionUrl(ctx.url)) {
    const url = typeof ctx.url === 'string' ? new URL(ctx.url) : ctx.url;
    if (!url.searchParams.has(NEON_AUTH_SESSION_VERIFIER_PARAM_NAME)) {
      url.searchParams.set(
        NEON_AUTH_SESSION_VERIFIER_PARAM_NAME,
        verifier
      );
      next = { ...ctx, url };
    }
  }

  return next;
};

/**
 * Single onSuccess hook used by both the standalone plugin and the wrapper.
 *
 *  - Captures the `set-auth-jwt` response header and injects the JWT into
 *    `ctx.data.session.token` BEFORE Better Auth processes the response,
 *    so the BA session-cache update sees the JWT and downstream
 *    `useSession.subscribe()` consumers cache the session with the JWT
 *    included.
 *  - Dispatches per-method `BETTER_AUTH_METHODS_HOOKS[method].onSuccess`
 *    (session cache write, anonymous-token cache, cross-tab broadcast).
 */
export const onSuccessHook = async (
  ctx: SuccessContext
): Promise<void> => {
  const jwt = ctx.response.headers.get('set-auth-jwt');
  if (jwt) {
    const data = ctx.data as { session?: { token?: string } } | undefined;
    if (data?.session) {
      data.session.token = jwt;
    }
  }

  const url = ctx.request.url.toString();
  const method = deriveBetterAuthMethodFromUrl(url);
  if (method) {
    await BETTER_AUTH_METHODS_HOOKS[method].onSuccess(ctx.data);
  }
};

/**
 * No-op onResponse used purely as a type-safety anchor; reserved for future
 * response transformations.
 */
export const onResponseHook = (_ctx: ResponseContext): void => {
  return;
};

/**
 * Normalize non-OK responses to a typed `AuthApiError` / `AuthError`. Throws
 * out of better-fetch's hook loop, so callers using `fetchOptions.throw: true`
 * — or those who chain into the action layer — see a typed Auth error.
 *
 * Callers using `throw: false` will get this error inside their try/await
 * (it propagates out of better-fetch's onError loop), preserving the same
 * surface the legacy `customFetchImpl` produced.
 */
export const onErrorHook = (ctx: ErrorContext): void => {
  const { response, error } = ctx;
  const body = (error ?? {}) as {
    message?: string;
    code?: string;
    [k: string]: unknown;
  };
  throw normalizeBetterAuthError({
    status: response.status,
    statusText: response.statusText,
    message:
      body.message || `HTTP ${response.status} ${response.statusText}`,
    code: body.code,
    body,
  });
};

/**
 * The single BetterFetchPlugin every Neon Auth client (wrapper or
 * stand-alone) installs. Wraps the hooks above behind a stable id.
 */
export const neonFetchPlugin: BetterFetchPlugin = {
  id: 'neon-fetch',
  name: 'neon-fetch',
  hooks: {
    onRequest: onRequestHook,
    onSuccess: onSuccessHook,
    onResponse: onResponseHook,
    onError: onErrorHook,
  },
};
