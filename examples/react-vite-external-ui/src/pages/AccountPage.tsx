import { useParams } from 'react-router-dom';
import { AccountView, RedirectToSignIn } from '@daveyplate/better-auth-ui';

export function AccountPage() {
  const { view } = useParams();

  return (
    <>
      <RedirectToSignIn />
      <main className="mx-auto max-w-4xl p-6">
        <AccountView pathname={view} />
      </main>
    </>
  );
}
