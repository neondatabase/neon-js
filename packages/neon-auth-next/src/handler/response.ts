// This is allowlist of headers that we want to proxy to the client
// We can proxy all headers, but its safer to only proxy the headers we need
const RESPONSE_HEADERS_ALLOWLIST = ['content-type', 'content-length', 'content-encoding', 'transfer-encoding',
    'connection', 'date',
   'set-cookie', 'set-auth-jwt', 'set-auth-token', 'x-neon-ret-request-id'];

export const handleAuthResponse = async (response: Response) => {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: prepareResponseHeaders(response),
  })
}

const prepareResponseHeaders = (response: Response) => {
  const headers = new Headers();
  for (const header of RESPONSE_HEADERS_ALLOWLIST) {
    const value = response.headers.get(header);
    if (value) {
      headers.set(header, value);
    }
  }
  return headers;
}

export const extractResponseCookies = (headers: Headers) => {
  const cookieHeader = headers.get('set-cookie');
  if (!cookieHeader) return [];

  const cookies = cookieHeader.split(', ').map(c => c.trim());
  return cookies;
}