import { AuthView } from "@neondatabase/auth/react";

export const dynamicParams = false;

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;

  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4">
      <AuthView path={path} />
    </main>
  );
}
