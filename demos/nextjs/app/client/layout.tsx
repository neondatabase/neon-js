'use client';

import { NeonAuthUIProvider } from '@neondatabase/neon-js/auth/react/ui';
import { authClient } from '@/lib/auth/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/client/header';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <NeonAuthUIProvider
      authClient={authClient}
      navigate={router.push}
      replace={router.replace}
      onSessionChange={() => {
        router.refresh();
      }}
      social={{
        providers: ['google'],
      }}
      emailOTP
      redirectTo="/client/account"
      Link={Link}
      basePath='/client/auth'
      organization={{
        basePath: '/client/organization',
      }}
      account={{
        basePath: '/client/account',
        viewPaths: {
          // ORGANIZATIONS: 'organizations',
        }
      }}
    >
      <div className="min-h-screen bg-background">
        <Header />
        {children}
      </div>
    </NeonAuthUIProvider>
  );
}
