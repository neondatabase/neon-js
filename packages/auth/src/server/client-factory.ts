import type { NeonAuthServer } from './types';
import type { SessionCookieSameSite } from './config';
import {
  NEON_AUTH_SERVER_PROXY_HEADER,
  type RequestContextFactory,
} from './request-context';
import {
  API_ENDPOINTS,
  type EndpointConfig,
  type EndpointTree,
} from './endpoints';
import { parseSetCookies, parseCookieValue } from '@/server/utils/cookies';
import { validateSessionData } from '@/server/session/validator';
import { NEON_AUTH_SESSION_COOKIE_NAME, NEON_AUTH_SESSION_DATA_COOKIE_NAME } from './constants';
import { mintSessionDataFromResponse } from './session/minting';
import { normalizeBetterAuthError } from '@/core/better-auth-helpers';
import type { ResolvedNeonAuthLogging } from './logger';
import { classifyFetchFailure } from './network-error';

export interface NeonAuthServerConfig {
  baseUrl: string;
  context: RequestContextFactory;
  cookieSecret: string;
  sessionDataTtl?: number;
  domain?: string;
  sameSite?: SessionCookieSameSite;
  /** Resolved logging sink */
  log?: ResolvedNeonAuthLogging;
}

export function createAuthServerInternal(
  config: NeonAuthServerConfig
): NeonAuthServer {
  const { baseUrl, context: getContext, cookieSecret, sessionDataTtl, domain, sameSite, log } = config;
  const effectiveSameSite = sameSite ?? 'strict';

  const fetchWithAuth = async (
    path: string,
    method: 'GET' | 'POST',
    args?: Record<string, unknown>
  ) => {
    const ctx = await getContext();
    const cookies = await ctx.getCookies();
    const origin = await ctx.getOrigin();
    const framework = ctx.getFramework();

    const url = new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
    const { query, fetchOptions: _fetchOptions, ...body } = args || {};

    if (query && typeof query === 'object') {
      const queryParams = query as Record<string, string | number | boolean>;
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      Cookie: cookies,
      Origin: origin,
      [NEON_AUTH_SERVER_PROXY_HEADER]: framework,
    };

    let requestBody: string | undefined;
    if (method === 'POST') {
      headers['Content-Type'] = 'application/json';
      // Always send at least {} for POST requests to avoid "empty body" errors
      requestBody = JSON.stringify(Object.keys(body).length > 0 ? body : {});
    }

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method,
        headers,
        body: requestBody,
      });
    } catch (error) {
      const classified = classifyFetchFailure(error);
      if (classified.kind === 'transport') {
        log?.warn('[neon-auth] Server API upstream fetch failed', {
          component: 'server-api',
          path: url.pathname,
          code: classified.code,
          detail: classified.detail,
          host: url.host,
        });
        return {
          data: null,
          error: {
            message: classified.clientMessage,
            status: 502,
            statusText: 'Bad Gateway',
            code: classified.code,
          },
        };
      }

      log?.error('[neon-auth] Server API unexpected fetch error', {
        component: 'server-api',
        path: url.pathname,
        detail: classified.detail,
        host: url.host,
        err: error,
      });

      throw error instanceof Error ? error : new Error(String(error));
    }

    if (response.ok) {
      log?.debug('[neon-auth] Server API upstream fetch completed', {
        component: 'server-api',
        path: url.pathname,
        status: response.status,
        host: url.host,
      });
    } else if (response.status >= 500) {
      log?.warn('[neon-auth] Server API upstream HTTP error', {
        component: 'server-api',
        path: url.pathname,
        status: response.status,
        statusText: response.statusText,
        host: url.host,
      });
    } else {
      log?.info('[neon-auth] Server API upstream HTTP non-2xx', {
        component: 'server-api',
        path: url.pathname,
        status: response.status,
        statusText: response.statusText,
        host: url.host,
      });
    }

    // Handle response cookies 
    const setCookieHeaders = response.headers.getSetCookie();
    if (setCookieHeaders.length > 0) {
      for (const setCookieHeader of setCookieHeaders) {
        const parsedCookies = parseSetCookies(setCookieHeader);
        for (const cookie of parsedCookies) {
          // Mirror sanitization from prepareResponseHeaders (response.ts):
          // strip Partitioned and apply configured SameSite (default `strict`).
          // Always override domain: use local config if set, otherwise strip any
          // upstream Domain attribute to avoid leaking the auth server's domain.
          const cookieOptions = {
            ...cookie,
            domain: domain,
            partitioned: undefined,
            sameSite: effectiveSameSite,
          };
          await ctx.setCookie(cookie.name, cookie.value, cookieOptions);
        }
      }

      // Mint session data cookie if session_token was set
      try {
        const sessionDataCookie = await mintSessionDataFromResponse(
          response.headers,
          baseUrl,
          {
            secret: cookieSecret,
            sessionDataTtl,
            domain,
            sameSite,
          }
        );

        if (sessionDataCookie) {
          // Parse the Set-Cookie string to extract cookie details
          const [parsedSessionData] = parseSetCookies(sessionDataCookie);
          if (parsedSessionData) {
            await ctx.setCookie(
              parsedSessionData.name,
              parsedSessionData.value,
              parsedSessionData
            );
          }
        }
      } catch (error) {
        log?.warn('[neon-auth] Failed to mint session data cookie', {
          component: 'server-api',
          detail: error instanceof Error ? error.message : String(error),
          err: error,
        });
      }
    }

    const responseData = await response.json().catch(() => null);
    if (!response.ok) {
      // Normalize through `normalizeBetterAuthError` to get a mapped
      // `.code` + canonical `.message`, but return the values as a plain
      // serializable object. An `AuthApiError` instance has a non-enumerable
      // `message`, no `statusText`, and is an `Error` subclass — shapes that
      // break `{...error}` spread and `JSON.stringify(error)` on the server
      // return surface. Keep the POJO contract `{ message, status,
      // statusText, code }` intact for server consumers.
      const normalized = normalizeBetterAuthError({
        status: response.status,
        statusText: response.statusText,
        message: responseData?.message || response.statusText,
        code: responseData?.code,
        body: responseData,
      });
      return {
        data: null,
        error: {
          message: normalized.message,
          status: normalized.status ?? response.status,
          statusText: response.statusText,
          code: normalized.code,
        },
      };
    }

    return {
      data: responseData,
      error: null,
    };
  };

  const baseServer = createApiProxy(API_ENDPOINTS, fetchWithAuth);

  // Store original getSession for fallback
  const originalGetSession = baseServer.getSession;

  // Override getSession directly on the proxy (don't spread - that breaks the proxy!)
  // Use 'any' for args to maintain compatibility with generic function signature
  baseServer.getSession = async (...args: any[]) => {
    // Extract query params from better-auth's args
    // Better-auth signature: getSession(data, fetchOptions)
    const [data] = args;
    const disableCookieCache = data?.query?.disableCookieCache === 'true';

    if (!disableCookieCache) {
      try {
        const ctx = await getContext();
        const cookiesString = await ctx.getCookies();

        const hasSessionToken = cookiesString.includes(NEON_AUTH_SESSION_COOKIE_NAME);
        const sessionDataCookie = parseCookieValue(
          cookiesString,
          NEON_AUTH_SESSION_DATA_COOKIE_NAME
        );

        // For valid session, both `session_token` and `session_data` cookies must exist
        if (sessionDataCookie && hasSessionToken) {
          const result = await validateSessionData(sessionDataCookie, cookieSecret);
          if (result.valid && result.payload) {
            return { data: result.payload, error: null } as any;
          }
        }
      } catch (error) {
        log?.warn('[neon-auth] Cookie validation error before getSession upstream call', {
          component: 'server-api',
          detail: error instanceof Error ? error.message : String(error),
          err: error,
        });
      }
    }

    // Fallback: Call upstream API
    return originalGetSession(...args);
  };

  return baseServer;
}

type FetchWithAuth = (
  path: string,
  method: 'GET' | 'POST',
  args?: Record<string, unknown>
) => Promise<unknown>;

function isEndpointConfig(value: unknown): value is EndpointConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    'path' in value &&
    'method' in value
  );
}

function createApiProxy(endpoints: EndpointTree, fetchFn: FetchWithAuth) {
  const target: Record<string, unknown> = {};

  return new Proxy(
    target,
    {
      get(target, prop: string) {
        // Check if property was manually set on the target
        if (prop in target) {
          return target[prop];
        }

        const endpoint = endpoints[prop];
        if (!endpoint) return;

        // If it's a leaf endpoint config, return a callable function
        if (isEndpointConfig(endpoint)) {
          return (args?: Record<string, unknown>) => fetchFn(endpoint.path, endpoint.method, args);
        }

        // Otherwise it's a nested namespace - return another proxy
        return createApiProxy(endpoint as EndpointTree, fetchFn);
      },
      set(target, prop: string, value) {
        // Allow setting properties on the target
        target[prop] = value;
        return true;
      },
    }
  ) as NeonAuthServer;
}
