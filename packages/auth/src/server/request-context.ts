/**
 * Header name used to identify server-side proxy requests.
 * The value will be the framework name (e.g., 'nextjs', 'remix').
 */
export const NEON_AUTH_SERVER_PROXY_HEADER = 'x-neon-auth-proxy';

/**
 * Framework-agnostic interface for accessing request context.
 * 
 * The idea is to write framework adapter that implements this interface for the specific framework. (Next.js, Remix, SolidStart, etc.)
 */
export interface RequestContext {
  getCookies(): Promise<string> | string;
  setCookie(
    name: string,
    value: string,
    options: CookieOptions
  ): Promise<void> | void;

  getHeader(name: string): Promise<string | null> | string | null;
  getOrigin(): Promise<string> | string;

  /**
   * Returns the framework identifier (e.g., 'nextjs', 'remix', 'solidstart').
   * Used to identify the source of server-side proxy requests.
   */
  getFramework(): string;
}

export interface CookieOptions {
  maxAge?: number;
  expires?: Date;
  path?: string;
  domain?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  partitioned?: boolean;
}

export type RequestContextFactory = () => RequestContext | Promise<RequestContext>;

