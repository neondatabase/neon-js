export { toNextJsHandler } from "./handler";

import { createAuthClient as createNeonAuthClient, BetterAuthReactAdapter } from "@neondatabase/neon-auth"

export * from "@neondatabase/neon-auth";

export const createAuthClient = () => {
  // @ts-expect-error - for nextjs proxy we do not need the baseUrl
  return createNeonAuthClient(undefined, {
    adapter: BetterAuthReactAdapter()
  })
}