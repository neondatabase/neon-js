'use client';

import {
  AuthUIProvider,
  type AuthUIProviderProps,
} from '@daveyplate/better-auth-ui';
import type {
  NeonAuthAdapter,
  NeonAuthPublicApi,
} from '@neondatabase/auth';
import { getReactClient } from './react-adapter';
import { Toaster } from 'sonner';
import { ThemeProvider } from 'next-themes';
import { useMemo } from 'react';

/**
 * Neon Auth UI Provider Props
 *
 * Accepts both vanilla and React Better Auth clients.
 * The vanilla client will be automatically converted to a React client.
 */
export type NeonAuthUIProviderProps<T extends NeonAuthAdapter> = Omit<
  AuthUIProviderProps,
  'authClient'
> & {
  authClient: NeonAuthPublicApi<T>;
};

export function NeonAuthUIProvider<T extends NeonAuthAdapter>({
  authClient,
  children,
  ...props
}: NeonAuthUIProviderProps<T>) {
  /*
   * If the authClient is a Better Auth client, convert it to a React client.
   * Otherwise, use the authClient directly.
   */
  const reactClient = useMemo(() => {
    return 'getBetterAuthInstance' in authClient
      ? getReactClient(authClient.getBetterAuthInstance())
      : getReactClient(authClient);
  }, [authClient]);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthUIProvider
        authClient={reactClient}
        {...props}
        multiSession={false}
        apiKey={false}
        magicLink={false}
        passkey={false}
        oneTap={false}
        genericOAuth={undefined}
        twoFactor={undefined}
      >
        {children}
        <Toaster />
      </AuthUIProvider>
    </ThemeProvider>
  );
}
