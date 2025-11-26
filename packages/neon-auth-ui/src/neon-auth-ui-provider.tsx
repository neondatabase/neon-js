'use client';

import {
  AuthUIProvider,
  type AuthUIProviderProps,
} from '@daveyplate/better-auth-ui';
import type {
  VanillaBetterAuthClient,
  ReactBetterAuthClient,
} from '@neondatabase/neon-auth';
import { getReactClient } from './react-adapter';
import { Toaster } from 'sonner';
import { ThemeProvider } from 'next-themes';

/**
 * Neon Auth UI Provider Props
 *
 * Accepts both vanilla and React Better Auth clients.
 * The vanilla client will be automatically converted to a React client.
 */
export type NeonAuthUIProviderProps = Omit<
  AuthUIProviderProps,
  'authClient'
> & {
  authClient: VanillaBetterAuthClient | ReactBetterAuthClient;
};

export function NeonAuthUIProvider({
  authClient,
  children,
  ...props
}: NeonAuthUIProviderProps) {
  // Convert vanilla client to React client if needed
  const reactClient = getReactClient(authClient);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthUIProvider authClient={reactClient} {...props}>
        {children}
        <Toaster />
      </AuthUIProvider>
    </ThemeProvider>
  );
}
