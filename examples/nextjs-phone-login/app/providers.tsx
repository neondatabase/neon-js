'use client';

import { NeonAuthUIProvider } from '@neondatabase/auth/react/ui';
import { authClient } from '@/lib/auth/client';
import { useRouter } from 'next/navigation';

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <NeonAuthUIProvider
      authClient={authClient}
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
