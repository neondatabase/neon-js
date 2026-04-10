import { createMiddleware } from '@tanstack/react-start';
import type { NeonAuthServer } from '@/server/types';

/**
 * @internal
 * Creates a middleware from a server instance getter. Used by createNeonAuth.
 */
export function createMiddlewareFromServer(
  getServer: () => NeonAuthServer,
) {
  return createMiddleware().server(async ({ next }) => {
    const { data: session } = await getServer().getSession();

    return next({
      context: {
        auth: session ?? { session: null, user: null },
      },
    });
  });
}
