export { toNextJsHandler } from "./handler";
export { neonAuthMiddleware } from "./middleware";
import { createAuthClient as createNeonAuthClient, BetterAuthReactAdapter } from "@neondatabase/auth"

export * from "@neondatabase/auth";

export const createAuthClient = () => {
  // @ts-expect-error - for nextjs proxy we do not need the baseUrl
  return createNeonAuthClient(undefined, {
    adapter: BetterAuthReactAdapter()
  })
}