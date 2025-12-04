import { NEON_AUTH_COOKIE_PREFIX } from "../constants";

const PROXY_HEADERS = ['user-agent', 'authorization', 'referer'];
export const handleAuthRequest = async (baseUrl: string, request: Request, path: string) => {
  const url = new URL(request.url);
  const upstreamURL = `${baseUrl}/${path}${url.search}`;
  const headers = prepareRequestHeaders(request);
  const body = await parseRequestBody(request);

  try {
    const response = await fetch(upstreamURL, {
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

const prepareRequestHeaders = (request: Request) => {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  
  for (const header of PROXY_HEADERS) {
    if (request.headers.get(header)) {
      headers.set(header, request.headers.get(header)!);
    }
  }
  
  headers.set('Origin', getOrigin(request));
  headers.set('Cookie', extractRequestCookies(request.headers));
  headers.set('X-Neon-Auth-Next', 'true');     // Add for observability purpose
  return headers;
}


// Get the origin from the requst headers or the url
const getOrigin = (request: Request) => {
 return request.headers.get('origin') ||
                   request.headers.get('referer')?.split('/').slice(0, 3).join('/') ||
                   new URL(request.url).origin;
}

const extractRequestCookies = (headers: Headers) => {
  const cookieHeader = headers.get('cookie');
  if (!cookieHeader) return '';

  const cookies = cookieHeader.split(';').map(c => c.trim());
  const result: string[] = [];

  for (const cookie of cookies) {
    const [name] = cookie.split('=');
    if (name.startsWith(NEON_AUTH_COOKIE_PREFIX)) {
      result.push(cookie);
    }
  }

  return result.join(';');
}

const parseRequestBody = async (request: Request) => {
  if (request.body) {
    return request.text();
  }

  return;
}