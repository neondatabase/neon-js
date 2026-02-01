import { BetterAuthReactAdapter } from '../../adapters/better-auth-react/better-auth-react-adapter';
import { createAuthClient as createNeonAuthClient } from '../../neon-auth';

/**
 * Creates a Neon Auth client for TanStack Start applications
 *
 * Pre-configured with BetterAuthReactAdapter to provide React hooks support.
 * This client should be used in client-side code for authentication operations.
 *
 * **Features:**
 * - React hooks (useSession, via Better Auth React)
 * - Type-safe auth methods
 * - Automatic proxy to server auth handler
 *
 * @returns Neon Auth client instance with React hooks support
 *
 * @example
 * ```typescript
 * // lib/auth-client.ts
 * 'use client';
 * import { createAuthClient } from '@neondatabase/auth/tanstack/start';
 *
 * export const authClient = createAuthClient();
 * ```
 *
 * @example
 * ```typescript
 * // components/UserMenu.tsx
 * import { authClient } from '@/lib/auth-client';
 *
 * export function UserMenu() {
 *   // Use React hooks from Better Auth
 *   const session = authClient.useSession();
 *
 *   if (session.isPending) return <div>Loading...</div>;
 *   if (!session.data) return <LoginButton />;
 *
 *   return <div>Hello {session.data.user.name}</div>;
 * }
 * ```
 *
 * @example
 * ```typescript
 * // routes/auth/sign-in.tsx - With Auth UI components
 * import { NeonAuthUIProvider, SignInForm } from '@neondatabase/auth-ui';
 * import { authClient } from '@/lib/auth-client';
 *
 * export default function SignIn() {
 *   return (
 *     <NeonAuthUIProvider authClient={authClient} redirectTo="/dashboard">
 *       <SignInForm />
 *     </NeonAuthUIProvider>
 *   );
 * }
 * ```
 */
export function createAuthClient() {
	// TanStack Start uses React, so we use the React adapter for hooks support
	// @ts-expect-error - for TanStack Start client-side, baseUrl is not needed (proxies to /api/auth)
	return createNeonAuthClient(undefined, {
		adapter: BetterAuthReactAdapter(),
	});
}
