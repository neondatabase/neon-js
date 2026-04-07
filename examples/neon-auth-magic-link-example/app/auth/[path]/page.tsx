import { MagicLinkForm } from "@/components/magic-link-form";
import { authViewPaths } from "@neondatabase/auth/react/ui/server";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(authViewPaths).map((path) => ({ path }));
}

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  await params;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <MagicLinkForm />
    </main>
  );
}
