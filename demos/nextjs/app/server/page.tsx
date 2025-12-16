import { CodeBlock } from '@/components/code-block';
import Link from 'next/link';

const setupCode = `import { createAuthServer } from '@neondatabase/auth/next/server';

export const authServer = createAuthServer();`;

const rscCode = `import { authServer } from '@/lib/auth/server';

export default async function Page() {
  const { data: session } = await authServer.getSession();

  if (!session) return <div>Not logged in</div>;

  return <div>Welcome, {session.user.name}!</div>;
}`;

const actionCode = `'use server';

import { authServer } from '@/lib/auth/server';

export async function updateUserName(name: string) {
  const { data, error } = await authServer.updateUser({ name });
  
  if (error) throw new Error(error.message);
  return data;
}`;

const adminCode = `// List users (admin only)
const { data: users } = await authServer.admin.listUsers({
  query: { limit: 10 },
});

// Ban a user
await authServer.admin.banUser({ userId: 'user_id' });`;

export default async function ServerHomePage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl px-4 py-12">
        {/* Hero */}
        <div className="mb-10">
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-500/20 dark:text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Server-Side
          </span>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Server Components & Actions
          </h1>
          <p className="mt-3 text-base text-zinc-600 dark:text-zinc-400">
            Access authentication APIs directly in React Server Components and Server Actions.
          </p>
        </div>

        {/* Navigation */}
        <div className="mb-10 flex flex-wrap gap-2">
          <Link
            href="/server/auth/sign-in"
            className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800 dark:hover:bg-zinc-800"
          >
            <svg className="h-4 w-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            Authentication
          </Link>
          <Link
            href="/server/account"
            className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800 dark:hover:bg-zinc-800"
          >
            <svg className="h-4 w-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            Account
          </Link>
          <Link
            href="/server/organization"
            className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800 dark:hover:bg-zinc-800"
          >
            <svg className="h-4 w-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
            Organizations
          </Link>
          <Link
            href="/server/admin"
            className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800 dark:hover:bg-zinc-800"
          >
            <svg className="h-4 w-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            Admin
          </Link>
        </div>

        {/* Setup */}
        <section className="mb-10">
          <h2 className="mb-5 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Setup
          </h2>
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
                Create the auth server instance:
              </p>
              <CodeBlock code={setupCode} filename="lib/auth/server.ts" />
            </div>
            <div>
              <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
                Use in Server Components:
              </p>
              <CodeBlock code={rscCode} filename="app/page.tsx" />
            </div>
            <div>
              <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
                Use in Server Actions:
              </p>
              <CodeBlock code={actionCode} filename="app/actions.ts" />
            </div>
          </div>
        </section>

        {/* Admin API */}
        <section className="mb-10">
          <h2 className="mb-5 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Admin APIs
          </h2>
          <CodeBlock code={adminCode} filename="admin-example.ts" />
        </section>

        {/* Features */}
        <section>
          <h2 className="mb-5 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Features
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Zero Client JS</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Authentication runs entirely on the server.
              </p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Auto Cookie Handling</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Cookies injected from next/headers automatically.
              </p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Admin APIs</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Manage users, sessions, and permissions.
              </p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Same Types</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Identical TypeScript types as client APIs.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
