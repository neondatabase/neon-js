import { BetterAuthReactAdapter } from '../adapters/better-auth-react/better-auth-react-adapter';
import { createAuthClient as createNeonAuthClient } from '../neon-auth';

/**
 * Creates a Neon Auth client for TanStack Start.
 *
 * The client SDK sends auth requests to your app's `/api/auth` proxy route
 * (not directly to the Neon Auth server). This requires mounting the server
 * handler — see `createNeonAuth` from `@neondatabase/auth/start/server`.
 *
 * @returns Auth client with React hooks (useSession) and auth methods (signIn, signUp, signOut, etc.)
 *
 * @example
 * ```typescript
 * // src/integrations/auth/client.ts
 * import { createAuthClient } from '@neondatabase/auth/start';
 *
 * export const authClient = createAuthClient();
 * ```
 *
 * @example
 * ```tsx
 * // Usage in a component
 * import { authClient } from '@/integrations/auth/client';
 *
 * function UserInfo() {
 *   const { data: session } = authClient.useSession();
 *   if (!session?.user) return <div>Not signed in</div>;
 *   return <div>Hello {session.user.name}</div>;
 * }
 * ```
 */
export function createAuthClient() {
  // @ts-expect-error - no baseUrl needed; client calls same-origin /api/auth proxy
  return createNeonAuthClient(undefined, {
    adapter: BetterAuthReactAdapter(),
  });
}
