import { BetterAuthReactAdapter } from '../adapters/better-auth-react/better-auth-react-adapter';
import { createAuthClient as createNeonAuthClient } from '../neon-auth';
export { authApiHandler } from './handler';
export { neonAuthMiddleware } from './middleware';
export { neonAuth } from './auth';

export function createAuthClient() {
  // @ts-expect-error - for nextjs proxy we do not need the baseUrl
  return createNeonAuthClient(undefined, {
    adapter: BetterAuthReactAdapter(),
  });
}
