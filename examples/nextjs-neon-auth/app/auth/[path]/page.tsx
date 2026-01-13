import { AuthView } from '@neondatabase/auth/react/ui';
import { authViewPaths } from '@neondatabase/auth/react/ui/server';
import Link from 'next/link';

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(authViewPaths).map((path) => ({ path }));
}

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;

  return (
    <main className="container mx-auto flex grow flex-col items-center justify-center self-center p-4 md:p-6">
      <AuthView path={path} />
      {!['callback', 'sign-out'].includes(path) && (
        <p className="w-3xs text-center text-muted-foreground text-xs mt-4">
          By continuing, you agree to our{' '}
          <Link
            className="text-foreground underline hover:text-primary"
            href="/terms"
            target="_blank"
          >
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link
            className="text-foreground underline hover:text-primary"
            href="/privacy"
            target="_blank"
          >
            Privacy Policy
          </Link>
          .
        </p>
      )}
    </main>
  );
}
