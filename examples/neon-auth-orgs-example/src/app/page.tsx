import { auth } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function Home() {
  const { data: session } = await auth.getSession();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] gap-6">
      <h1 className="text-4xl font-bold">Org Todos</h1>
      <p className="text-muted-foreground text-lg">
        Multi-tenant todo app with organizations
      </p>
      <Link
        href="/auth/sign-in"
        className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
      >
        Get Started
      </Link>
    </div>
  );
}
