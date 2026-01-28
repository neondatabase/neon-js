import { extractNeonAuthCookies } from "@/server/utils/cookies";

const PROXY_HEADERS = ['user-agent', 'authorization', 'referer', 'content-type'];

/**
 * Proxy header constant - indicates request went through Neon Auth middleware/handler
 * This is framework-agnostic and can be used by any server framework
 */
export const NEON_AUTH_HEADER_MIDDLEWARE_NAME = 'x-neon-auth-middleware';

/**
 * Handles proxying authentication requests to the upstream Neon Auth server
 *
 * @param baseUrl - Base URL of the Neon Auth server
 * @param request - Standard Web API Request object
 * @param path - API path to proxy to (e.g., 'get-session', 'sign-in')
 * @returns Response from upstream server or error response
 */
export const handleAuthRequest = async (baseUrl: string, request: Request, path: string) => {
  const headers = prepareRequestHeaders(request);
  const body = await parseRequestBody(request);

  try {
    const upstreamURL = getUpstreamURL(baseUrl, path, { originalUrl: new URL(request.url) });
    const response = await fetch(upstreamURL.toString(), {
      method: request.method,
      headers: headers,
      body: body,
    })

    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'TypeError' && error.message.includes('fetch')) {
      return Response.json({
        error: 'Unable to connect to authentication server',
        code: 'NETWORK_ERROR'
      }, { status: 502, headers: { 'Content-Type': 'application/json' } });
    }
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error(`[AuthError] ${message}`, error);
    return Response.json(
      {
        error: message,
        code: 'INTERNAL_ERROR',
      },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Constructs the upstream URL for proxying to Neon Auth server
 *
 * @param baseUrl - Base URL of the Neon Auth server
 * @param path - API path (e.g., 'get-session')
 * @param options - Options including original URL for preserving query params
 * @returns Constructed upstream URL
 */
export const getUpstreamURL = (baseUrl: string, path: string, {
  originalUrl
}: {
  originalUrl?: URL;
}) => {
  const url = new URL(`${baseUrl}/${path}`);
  if (originalUrl) {
    url.search = originalUrl.search;
    return url;
  }
  return url;
}

const prepareRequestHeaders = (request: Request) => {
  const headers = new Headers();

  for (const header of PROXY_HEADERS) {
    if (request.headers.get(header)) {
      headers.set(header, request.headers.get(header)!);
    }
  }
  headers.set('Origin', getOrigin(request));
  headers.set('Cookie', extractNeonAuthCookies(request.headers));
  headers.set(NEON_AUTH_HEADER_MIDDLEWARE_NAME, 'true');
  return headers;
}


// Get the origin from the request headers or the url
const getOrigin = (request: Request) => {
 return request.headers.get('origin') ||
                   request.headers.get('referer')?.split('/').slice(0, 3).join('/') ||
                   new URL(request.url).origin;
}


const parseRequestBody = async (request: Request) => {
  if (request.body) {
    return request.text();
  }

  return;
}
