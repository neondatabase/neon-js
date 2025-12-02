const NEXT_AUTH_COOKIE_PREFIX = '__Secure-neon-auth';
const PROXY_HEADERS = ['user-agent', 'authorization', 'referer'];

export const handleAuthRequest = async (baseUrl: string, request: Request, path: string) => {
  const upstreamURL = `${baseUrl}/${path}`;
  const headers = prepareRequestHeaders(request);
  const body = await parseRequestBody(request);
  console.debug("[Auth Proxy] Request:", request.method, upstreamURL, headers);

  try {
    const response = await fetch(upstreamURL, {
      method: request.method,
      headers: headers,
      body: body,
    })
    console.debug("[Auth Proxy] Response:", request.url, response.status, response.statusText);

    const cookies = response.headers.get('set-cookie');
    console.debug("[Auth Proxy] Cookies:", cookies);
    console.debug("[Auth Proxy] Response Headers:", response.headers);

    return response;
  } catch (error) {
    console.error("[Auth Proxy] Error:", error);
    return new Response("Internal Server Error", { status: 500 });
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
  headers.set('Cookie', extractRequestCookies(request));
  return headers;
}


// Get the origin from the requst headers or the url
const getOrigin = (request: Request) => {
 return request.headers.get('origin') ||
                   request.headers.get('referer')?.split('/').slice(0, 3).join('/') ||
                   new URL(request.url).origin;
}

const extractRequestCookies = (request: Request) => {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return '';

  const cookies = cookieHeader.split(';').map(c => c.trim());
  const result: string[] = [];

  for (const cookie of cookies) {
    const [name] = cookie.split('=');
    if (name.startsWith(NEXT_AUTH_COOKIE_PREFIX)) {
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