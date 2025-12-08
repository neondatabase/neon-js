import { parseCookies, parseSetCookieHeader } from "better-auth/cookies";
import { NEON_AUTH_COOKIE_PREFIX } from "../constants";

type RequestCookie = {
  name: string;
  value: string;
}

type ResponseCookie = {
  name: string;
  value: string,
  maxAge?: number | undefined;
	expires?: Date | undefined;
	domain?: string | undefined;
	path?: string | undefined;
	secure?: boolean | undefined;
	httpOnly?: boolean | undefined;
  partitioned?: boolean | undefined;
	sameSite?: ("strict" | "lax" | "none") | undefined;
}

/**
 * Extract the Neon Auth cookies from the request headers that starts with the NEON_AUTH_COOKIE_PREFIX.
 * 
 * @param headers - The request headers.
 * @returns The cookie string with all Neon Auth cookies.
 */
export function extractRequestCookies(headers: Headers): string {
  const cookieHeader = headers.get('cookie');
  if (!cookieHeader) return '';

  const parsedCookies = parseCookies(cookieHeader)
  const result: RequestCookie[] = [];
  for (const [name, value] of parsedCookies.entries()) {
    if (name.startsWith(NEON_AUTH_COOKIE_PREFIX)) {
      result.push({name, value});
    }
  }
  return result.map(cookie => cookie.name + '=' + cookie.value).join('; ');
}


/**
 * Extract the Neon Auth cookies from the response headers that starts with the NEON_AUTH_COOKIE_PREFIX.
 * 
 * @param headers - The response headers.
 * @returns The cookies that starts with the NEON_AUTH_COOKIE_PREFIX.
 */
export const extractResponseCookies = (headers: Headers) => {
  const cookieHeader = headers.get('set-cookie');
  if (!cookieHeader) return [];

  const cookies = cookieHeader.split(', ').map(c => c.trim());
  return cookies;
}

/**
 * 
 * Parses the `set-cookie` header from Neon Auth response into the list of ResponseCookies,
 *  compatible with NextCookies.
 * 
 * @param cookies - The `set-cookie` header from Neon Auth response.
 * @returns The list of ResponseCookies.
 */
export const parseSetCookies = (cookies: string) => {
  const parsedCookies = parseSetCookieHeader(cookies)
  const responseCookies: ResponseCookie[] = [];
  for (const entry of parsedCookies.entries()) {
    const [name, parsedCookie] = entry
    responseCookies.push({
      name,
      value: decodeURIComponent(parsedCookie.value),
      path: parsedCookie.path,
      maxAge: parsedCookie['max-age'] ?? parsedCookie.maxAge,
      httpOnly: parsedCookie.httponly ?? true,
      secure: parsedCookie.secure ?? true, 
      sameSite: parsedCookie.samesite ?? 'none',
      partitioned: parsedCookie.partitioned
    })
  }
  return responseCookies;
}
