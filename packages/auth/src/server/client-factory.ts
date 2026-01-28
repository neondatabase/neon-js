import type { NeonAuthServer } from './types';
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
import { NEON_AUTH_SESSION_DATA_COOKIE_NAME } from './constants';
import { mintSessionData } from './proxy';

export interface NeonAuthServerConfig {
  baseUrl: string;
  context: RequestContextFactory;
  cookieSecret: string;
  sessionDataTtl?: number;
  domain?: string;
}

export function createAuthServerInternal(
  config: NeonAuthServerConfig
): NeonAuthServer {
  const { baseUrl, context: getContext, cookieSecret, sessionDataTtl, domain } = config;

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

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: requestBody,
    });

    // Handle response cookies 
    const setCookieHeaders = response.headers.getSetCookie();
    if (setCookieHeaders.length > 0) {
      for (const setCookieHeader of setCookieHeaders) {
        const parsedCookies = parseSetCookies(setCookieHeader);
        for (const cookie of parsedCookies) {
          // Override domain if configured
          const cookieOptions = domain ? { ...cookie, domain } : cookie;
          await ctx.setCookie(cookie.name, cookie.value, cookieOptions);
        }
      }

      // Mint session data cookie if session_token was set
      try {
        const sessionDataCookie = await mintSessionData(response.headers, baseUrl, {
          secret: cookieSecret,
          sessionDataTtl,
          domain,
        });

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
        // Log error but don't fail the request - session cache is optional
        console.error('[fetchWithAuth] Failed to mint session data cookie:', error);
      }
    }

    // Parse response
    const responseData = await response.json().catch(() => null);

    // Return in the same format as better-auth client
    if (!response.ok) {
      return {
        data: null,
        error: {
          message: responseData?.message || response.statusText,
          status: response.status,
          statusText: response.statusText,
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
        const sessionDataCookie = parseCookieValue(
          cookiesString,
          NEON_AUTH_SESSION_DATA_COOKIE_NAME
        );

        if (sessionDataCookie) {
          const result = await validateSessionData(sessionDataCookie, cookieSecret);

          if (result.valid && result.payload) {
            // Cache hit - return immediately (no network call)
            return { data: result.payload, error: null } as any;
          }
        }
      } catch (error) {
        // Log error but fall through to API call
        console.error('[auth.getSession] Cookie validation error:', error);
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
