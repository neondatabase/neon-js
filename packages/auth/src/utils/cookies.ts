import { parseCookies, parseSetCookieHeader } from 'better-auth/cookies';
import { NEON_AUTH_COOKIE_PREFIX } from '../core/constants';

export interface ParsedCookie {
  name: string;
  value: string;
  maxAge?: number;
  expires?: Date;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  partitioned?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}

/**
 * Extract the Neon Auth cookies from the request headers.
 * Only returns cookies that start with the NEON_AUTH_COOKIE_PREFIX.
 *
 * @param headers - The request headers or cookie header string.
 * @returns The cookie string with all Neon Auth cookies (e.g., "name=value; name2=value2").
 */
export const extractNeonAuthCookies = (headers: Headers | string): string => {
  const cookieHeader =
    typeof headers === 'string' ? headers : headers.get('cookie');
  if (!cookieHeader) return '';

  const parsedCookies = parseCookies(cookieHeader);
  const result: string[] = [];

  for (const [name, value] of parsedCookies.entries()) {
    if (name.startsWith(NEON_AUTH_COOKIE_PREFIX)) {
      result.push(`${name}=${value}`);
    }
  }

  return result.join('; ');
}

/**
 * Parses the `set-cookie` header from Neon Auth response into a list of cookies.
 *
 * @param setCookieHeader - The `set-cookie` header from Neon Auth response.
 * @returns The list of parsed cookies with their options.
 */
export const parseSetCookies = (setCookieHeader: string): ParsedCookie[] => {
  const parsedCookies = parseSetCookieHeader(setCookieHeader);
  const cookies: ParsedCookie[] = [];

  for (const entry of parsedCookies.entries()) {
    const [name, parsedCookie] = entry;
    cookies.push({
      name,
      value: decodeURIComponent(parsedCookie.value),
      path: parsedCookie.path,
      maxAge: parsedCookie['max-age'] ?? parsedCookie.maxAge,
      httpOnly: parsedCookie.httponly ?? true,
      secure: parsedCookie.secure ?? true,
      sameSite: parsedCookie.samesite ?? 'lax',
      partitioned: parsedCookie.partitioned,
    });
  }

  return cookies;
}



