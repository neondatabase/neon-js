import { OrganizationView } from '@neondatabase/neon-js/auth/react/ui';
import { organizationViewPaths } from '@neondatabase/neon-js/auth/react/ui/server';

export const dynamicParams = false;

export function generateStaticParams() {
  return [
    { path: [] }, // /client/organization (index)
    ...Object.values(organizationViewPaths).map((path) => ({ path: [path] })),
  ];
}

export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path } = await params;
  const pagePath = path?.[0] || '';

  return (
    <main className="container p-4 md:p-6">
      <OrganizationView path={pagePath} />
    </main>
  );
}

