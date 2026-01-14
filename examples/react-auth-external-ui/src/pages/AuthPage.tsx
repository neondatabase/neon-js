import { useParams } from 'react-router-dom';
import { AuthView } from '@daveyplate/better-auth-ui';

export function AuthPage() {
  const { pathname } = useParams();

  return (
    <main className="flex min-h-[calc(100vh-64px)] items-center justify-center p-4">
      <AuthView pathname={pathname} />
    </main>
  );
}
