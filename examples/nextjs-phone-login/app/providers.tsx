'use client';

import { NeonAuthUIProvider } from '@neondatabase/auth-ui';
import { authClient } from '@/lib/auth/client';
import { useRouter } from 'next/navigation';

type NeonAuthUIProviderAuthClient = Parameters<
  typeof NeonAuthUIProvider
>[0]['authClient'];

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <NeonAuthUIProvider
      authClient={authClient as NeonAuthUIProviderAuthClient}
      navigate={(path) => router.push(path)}
      replace={(path) => router.replace(path)}
      onSessionChange={() => router.refresh()}
      emailOTP
      social={{ providers: ['google'] }}
      redirectTo="/dashboard"
      signUp={{ fields: ['name'] }}
    >
      {children}
    </NeonAuthUIProvider>
  );
}
