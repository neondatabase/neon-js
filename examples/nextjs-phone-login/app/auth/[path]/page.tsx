import { AuthView } from '@neondatabase/auth/react/ui';
import { authViewPaths } from '@neondatabase/auth/react/ui/server';
import { PhoneSignInSection } from './phone-sign-in-section';

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(authViewPaths).map((path) => ({ path }));
}

export default async function AuthPage({ params }: { params: Promise<{ path: string }> }) {
  const { path } = await params;
  const isSignIn = path === authViewPaths.SIGN_IN;

  return (
    <div className="flex justify-center py-8">
      <div className="w-full max-w-sm space-y-6">
        <AuthView path={path} />

        {isSignIn && <PhoneSignInSection />}
      </div>
    </div>
  );
}
