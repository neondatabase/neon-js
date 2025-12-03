export { toNextJsHandler } from "./handler";

import { createAuthClient as createNeonAuthClient, BetterAuthReactAdapter } from "@neondatabase/neon-auth"

export * from "@neondatabase/neon-auth";

export const createAuthClient = () => {
  // @ts-expect-error - createAuthClient expects a string, but we don't need it here
  return createNeonAuthClient(undefined, {
    adapter: BetterAuthReactAdapter()
  })
}