'use client';

import {
  AuthUIProvider,
  type AuthUIProviderProps,
} from '@daveyplate/better-auth-ui';
import type { NeonAuthAdapter, NeonAuthPublicApi } from '@neondatabase/auth';
import { getReactClient } from './react-adapter';
import { Toaster } from 'sonner';
import { ThemeProvider } from 'next-themes';
import { useMemo } from 'react';
import { cn } from './utils';

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
  /** Additional class names for the wrapper div */
  className?: string;
  /** Default theme for next-themes. Defaults to 'system'. */
  defaultTheme?: 'light' | 'dark' | 'system';
};

export function NeonAuthUIProvider<T extends NeonAuthAdapter>({
  authClient,
  children,
  className,
  defaultTheme = 'system',
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
    <div className={cn('neon-auth-ui', className)}>
      <ThemeProvider attribute="class" defaultTheme={defaultTheme} enableSystem>
        {/*
          Explicit compatibility assertion: pnpm still resolves `better-auth` to
          separate virtual-store instances for @neondatabase/auth and this
          package, so the structurally-identical client types are not the same
          TS instance. pnpm.overrides keeps both on one version, which is enough
          for a single `as` here instead of `as unknown as`.
          History: first cast 9b02f94, widened at d6317e5, narrowed on 1.6.x.
        */}
        <AuthUIProvider
          authClient={reactClient as AuthUIProviderProps['authClient']}
          magicLink={false}
          {...props}
          multiSession={false}
          apiKey={false}
          passkey={false}
          oneTap={false}
          genericOAuth={undefined}
          twoFactor={undefined}
        >
          {children}
          <Toaster />
        </AuthUIProvider>
      </ThemeProvider>
    </div>
  );
}
