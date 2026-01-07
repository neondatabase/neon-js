import { NeonAuthUIProvider } from '@neondatabase/neon-js/auth/react';
import { useNavigate } from 'react-router-dom';
import { Link as RouterLink } from 'react-router-dom';
import { neonClient } from './client';
import '@neondatabase/neon-js/ui/css';
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
    <NeonAuthUIProvider
      authClient={neonClient.auth}
      navigate={navigate}
      social={{
        providers: ['github', 'google'], // Remove: discord, apple, microsoft
      }}
      magicLink={false}
      multiSession={false}
      redirectTo="/dashboard"
      Link={Link}
      // Avatar configuration with base64 storage (no server needed)
      avatar={{
        size: 256,
        extension: 'webp',
      }}
      // Configure sign-up to show additional fields
      signUp={{
        fields: ['name'],
      }}
      // Configure account settings to show custom fields
      account={{
        fields: ['image', 'name', 'company', 'age', 'newsletter'],
      }}
      // Custom localization for a personalized experience
      localization={{
        SIGN_IN: 'Welcome Back',
        SIGN_IN_DESCRIPTION: 'Sign in to your account to continue',
        SIGN_UP: 'Create Account',
        SIGN_UP_DESCRIPTION: 'Join us today and get started',
        FORGOT_PASSWORD: 'Forgot Password?',
        FORGOT_PASSWORD_DESCRIPTION: 'Enter your email to reset your password',
        RESET_PASSWORD: 'Reset Password',
        RESET_PASSWORD_DESCRIPTION: 'Enter your new password below',
        CHANGE_PASSWORD: 'Change Password',
        CHANGE_PASSWORD_DESCRIPTION:
          'Enter your current password and a new password',
        CHANGE_PASSWORD_SUCCESS: 'Your password has been changed successfully',
        OR_CONTINUE_WITH: 'or continue with',
        SETTINGS: 'Account Settings',
        SECURITY: 'Security Settings',
        SESSIONS: 'Active Sessions',
      }}
      // Enable credentials (email/password) with forgot password support
      credentials={{
        forgotPassword: true,
      }}
    >
      {children}
    </NeonAuthUIProvider>
  );
}
