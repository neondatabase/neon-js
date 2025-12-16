
/**
 * Extract the Neon Auth cookies from the response headers.
 * @deprecated Use parseSetCookies instead
 */
export const extractResponseCookies = (headers: Headers) => {
  const cookieHeader = headers.get('set-cookie');
  if (!cookieHeader) return [];

  const cookies = cookieHeader.split(', ').map((c) => c.trim());
  return cookies;
};
