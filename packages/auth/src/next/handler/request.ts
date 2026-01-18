import { extractNeonAuthCookies } from "../../server/utils/cookies";
import { NEON_AUTH_HEADER_MIDDLEWARE_NAME } from "../constants";

const PROXY_HEADERS = ['user-agent', 'authorization', 'referer', 'content-type'];
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
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error(`[AuthError] ${message}`, error);
    return new Response(`[AuthError] ${message}`, { status: 500 });
  }
}

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


// Get the origin from the requst headers or the url
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