'use client';

import {
  AuthUIProvider,
  type AuthUIProviderProps,
} from '@daveyplate/better-auth-ui';
import type {
  NeonAuthAdapter,
  NeonAuthPublicApi,
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
  const reactClient =
    'getBetterAuthInstance' in authClient
      ? getReactClient(authClient.getBetterAuthInstance())
      : getReactClient(authClient);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthUIProvider
        authClient={reactClient}
        {...props}
        multiSession={false}
        apiKey={false}
      >
        {children}
        <Toaster />
      </AuthUIProvider>
    </ThemeProvider>
  );
}
