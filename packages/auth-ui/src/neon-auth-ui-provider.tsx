'use client';

import {
  AuthUIContext,
  AuthUIProvider,
  useAuthData,
  type AuthUIProviderProps,
} from '@daveyplate/better-auth-ui';
import type { NeonAuthAdapter, NeonAuthPublicApi } from '@neondatabase/auth';
import { getReactClient } from './react-adapter';
import { Toaster } from 'sonner';
import { ThemeProvider } from 'next-themes';
import { useContext, useMemo } from 'react';
import {
  createUnlinkAccount,
  resolveAccountInfoId,
  type ListedAccount,
} from './local-account-id';
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

  /*
   * better-auth-ui builds its default mutators and hooks inside AuthUIProvider
   * and does not export them, so these wrap the same authClient calls.
   */
  const accountOverrides = useMemo(() => {
    const client = reactClient as AuthUIProviderProps['authClient'];
    return {
      mutators: {
        unlinkAccount: createUnlinkAccount(
          client as unknown as Parameters<typeof createUnlinkAccount>[0]
        ),
      },
      // better-auth-ui types the account-info user as a full Better Auth
      // `User`, but the endpoint returns the narrower provider `OAuth2UserInfo`.
      hooks: {
        useAccountInfo: (params: unknown) => {
          const {
            hooks: { useListAccounts },
          } = useContext(AuthUIContext);
          const { data: accounts } = useListAccounts();
          const accountId = resolveAccountInfoId(
            accounts as ListedAccount[] | null | undefined,
            (params as { query?: { accountId?: string } }).query?.accountId
          );
          // null, not undefined: useAuthData refetches when cached data is undefined.
          return useAuthData({
            queryFn:
              accountId === 'pending'
                ? async () => ({ data: null, error: null })
                : () =>
                    client.accountInfo({
                      query: { accountId: accountId as string },
                    }),
            cacheKey: `accountInfo:${accountId}`,
          });
        },
      } as AuthUIProviderProps['hooks'],
    };
  }, [reactClient]);

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
          mutators={{ ...accountOverrides.mutators, ...props.mutators }}
          hooks={{ ...accountOverrides.hooks, ...props.hooks }}
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
