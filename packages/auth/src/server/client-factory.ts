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

export interface NeonAuthServerConfig {
  baseUrl: string;
  context: RequestContextFactory;
  cookieSecret: string;
}

export function createAuthServerInternal(
  config: NeonAuthServerConfig
): NeonAuthServer {
  const { baseUrl, context: getContext, cookieSecret } = config;

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
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      const parsedCookies = parseSetCookies(setCookieHeader);
      for (const cookie of parsedCookies) {
        await ctx.setCookie(cookie.name, cookie.value, cookie);
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
  type GetSessionType = typeof baseServer.getSession;

  return {
    ...baseServer,
    getSession: (async (...args: Parameters<GetSessionType>): Promise<ReturnType<GetSessionType>> => {
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
              return { data: result.payload, error: null };
            }
          }
        } catch (error) {
          // Log error but fall through to API call
          console.error('[createAuthServerInternal.getSession] Cookie validation error:', error);
        }
      }

      // Fallback: Call upstream API
      return baseServer.getSession(...args);
    }),
  };
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
  return new Proxy(
    {},
    {
      get(_, prop: string) {
        const endpoint = endpoints[prop];
        if (!endpoint) return;

        // If it's a leaf endpoint config, return a callable function
        if (isEndpointConfig(endpoint)) {
          return (args?: Record<string, unknown>) => fetchFn(endpoint.path, endpoint.method, args);
        }

        // Otherwise it's a nested namespace - return another proxy
        return createApiProxy(endpoint as EndpointTree, fetchFn);
      },
    }
  ) as NeonAuthServer;
}
