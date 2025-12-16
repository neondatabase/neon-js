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
import { parseSetCookies } from '../utils/cookies';

export interface NeonAuthServerConfig {
  baseUrl: string;
  context: RequestContextFactory;
}

export function createAuthServerInternal(
  config: NeonAuthServerConfig
): NeonAuthServer {
  const { baseUrl, context: getContext } = config;

  const fetchWithAuth = async (path: string, data?: unknown) => {
    const ctx = await getContext();
    const cookies = await ctx.getCookies();
    const origin = await ctx.getOrigin();
    const framework = ctx.getFramework();

    const url = new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);

    // For GET requests with data, append as query params
    if (data && typeof data === 'object') {
      const params = data as Record<string, string | number | boolean>;
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Cookie: cookies,
        Origin: origin,
        [NEON_AUTH_SERVER_PROXY_HEADER]: framework,
      },
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

  return createApiProxy(API_ENDPOINTS, fetchWithAuth) as NeonAuthServer;
}

type FetchWithAuth = (path: string, data?: unknown) => Promise<unknown>;

function isEndpointConfig(value: unknown): value is EndpointConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    'path' in value &&
    'method' in value
  );
}

function createApiProxy(endpoints: EndpointTree, fetchFn: FetchWithAuth): unknown {
  return new Proxy(
    {},
    {
      get(_, prop: string) {
        const endpoint = endpoints[prop];
        if (!endpoint) return;

        // If it's a leaf endpoint config, return a callable function
        if (isEndpointConfig(endpoint)) {
          return (data?: unknown) => fetchFn(endpoint.path, data);
        }

        // Otherwise it's a nested namespace - return another proxy
        return createApiProxy(endpoint as EndpointTree, fetchFn);
      },
    }
  );
}
