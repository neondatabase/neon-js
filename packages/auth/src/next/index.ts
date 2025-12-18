import { BetterAuthReactAdapter } from '../adapters/better-auth-react/better-auth-react-adapter';
import { createAuthClient as createNeonAuthClient } from '../neon-auth';

import { authApiHandler as _authApiHandler} from './handler';
import { neonAuthMiddleware as _neonAuthMiddleware } from './middleware';
import { neonAuth as _neonAuth } from './auth';

export function createAuthClient() {
  // @ts-expect-error - for nextjs proxy we do not need the baseUrl
  return createNeonAuthClient(undefined, {
    adapter: BetterAuthReactAdapter(),
  });
}


/**
 * @deprecated 
 * - Moved to `@neondatabase/auth/next/server` and 
 * - Moved to `@neondatabase/neon-js/auth/next/server` 
 * 
 * An API route handler to handle the auth requests from the client and proxy them to the Neon Auth.
 */
export function authApiHandler() {
  return _authApiHandler();
}

/**
 * @deprecated 
 * - Moved to `@neondatabase/auth/next/server` and 
 * - Moved to `@neondatabase/neon-js/auth/next/server` 
 * 
 * A Next.js middleware to protect routes from unauthenticated requests and refresh the session if required.
 */
export function neonAuthMiddleware(args: Parameters<typeof _neonAuthMiddleware>[0]) {
  return _neonAuthMiddleware(args);
}

/**
 * @deprecated 
 * - Moved to `@neondatabase/auth/next/server` and 
 * - Moved to `@neondatabase/neon-js/auth/next/server` 
 * 
 * A utility function to be used in react server components fetch the session details from the Neon Auth API, if session token is available in cookie.
 */
export function neonAuth() {
  return _neonAuth();
}