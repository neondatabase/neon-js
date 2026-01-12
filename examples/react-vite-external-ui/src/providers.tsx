import { AuthUIProvider } from '@daveyplate/better-auth-ui';
import { neonAuthClient } from './client';

import { useNavigate, Link as RouterLink } from 'react-router-dom';
import type { ReactNode } from 'react';

const Link = ({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) => (
  <RouterLink to={href} className={className}>
    {children}
  </RouterLink>
);

export function Providers({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    // @ts-expect-error - neonAuthClient is a valid auth client
    <AuthUIProvider authClient={neonAuthClient} navigate={navigate} Link={Link}>
      {children}
    </AuthUIProvider>
  );
}
