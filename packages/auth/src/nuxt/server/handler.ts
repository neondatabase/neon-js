import {
  appendResponseHeader,
  createError,
  defineEventHandler,
  getRequestHeaders,
  getRequestURL,
  readRawBody,
  setResponseHeader,
  setResponseStatus,
  type H3Event,
  type StatusCode,
} from 'h3';
import {
  handleAuthProxyRequest,
  type AuthProxyConfig,
} from '../../server';

const AUTH_ROUTE_PREFIX = '/api/auth';
const PAYLOAD_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export type NuxtAuthProxyConfig = Omit<AuthProxyConfig, 'request' | 'path'>;

/**
 * Returns the catch-all path after `/api/auth`.
 */
export function getAuthProxyPath(pathname: string): string {
  if (pathname === AUTH_ROUTE_PREFIX || pathname === `${AUTH_ROUTE_PREFIX}/`) {
    return '';
  }

  if (!pathname.startsWith(`${AUTH_ROUTE_PREFIX}/`)) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
    });
  }

  return pathname.slice(AUTH_ROUTE_PREFIX.length + 1);
}

/**
 * Converts an H3 event into a Fetch Request without parsing its body.
 */
export async function createFetchRequest(
  event: H3Event,
  includeBody: boolean
): Promise<Request> {
  const method = event.method;
  const headers = new Headers();

  for (const [name, value] of Object.entries(getRequestHeaders(event))) {
    if (value !== undefined) headers.set(name, value);
  }

  const init: RequestInit & { duplex?: 'half' } = {
    method,
    headers,
  };

  if (includeBody && PAYLOAD_METHODS.has(method)) {
    const rawBody = await readRawBody(event, false);
    if (rawBody !== undefined) {
      init.body = Uint8Array.from(rawBody);
      init.duplex = 'half';
    }
  }

  return new Request(getRequestURL(event), init);
}

/**
 * Applies a Fetch Response to H3 while keeping Set-Cookie values separate.
 */
export function applyFetchResponse(
  event: H3Event,
  response: Response
): ReadableStream<Uint8Array> | string {
  setResponseStatus(
    event,
    response.status as StatusCode,
    response.statusText || undefined
  );

  for (const [name, value] of response.headers as unknown as Iterable<
    [string, string]
  >) {
    if (name.toLowerCase() !== 'set-cookie') {
      setResponseHeader(event, name, value);
    }
  }

  for (const cookie of response.headers.getSetCookie()) {
    appendResponseHeader(event, 'set-cookie', cookie);
  }

  return response.body ?? '';
}

/**
 * Creates the Nitro event handler mounted at `/api/auth/[...path]`.
 */
export function authApiHandler(config: NuxtAuthProxyConfig) {
  return defineEventHandler(async (event) => {
    const request = await createFetchRequest(event, true);
    const path = getAuthProxyPath(new URL(request.url).pathname);
    const response = await handleAuthProxyRequest({
      ...config,
      request,
      path,
    });

    return applyFetchResponse(event, response);
  });
}
