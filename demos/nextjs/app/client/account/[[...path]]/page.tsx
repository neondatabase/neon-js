import { AccountView } from '@neondatabase/neon-js/auth/react/ui';
import { accountViewPaths } from '@neondatabase/neon-js/auth/react/ui/server';

export const dynamicParams = false;

export function generateStaticParams() {
  return [
    { path: [] }, // /client/account (index)
    ...Object.values(accountViewPaths).map((path) => ({ path: [path] })),
  ];
}

export default async function AccountPage({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path } = await params;
  const pagePath = path?.[0] || '';

  return (
    <main className="container p-4 md:p-6">
      <AccountView path={pagePath} />
    </main>
  );
}

