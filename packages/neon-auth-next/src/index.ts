export { toNextJsHandler } from "./handler";

import { createAuthClient as createNeonAuthClient, BetterAuthReactAdapter } from "@neondatabase/neon-auth"

export * from "@neondatabase/neon-auth";

export const createAuthClient = () => {
  return createNeonAuthClient('/api/auth', {
    adapter: BetterAuthReactAdapter()
  })
}