import { CodeBlock } from '@/components/code-block';
import Link from 'next/link';

const setupCode = `import { createAuthClient } from '@neondatabase/auth/react';

export const authClient = createAuthClient();`;

const usageCode = `'use client';

import { authClient } from '@/lib/auth/client';

export default function Page() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return <div>Loading...</div>;
  if (!session) return <div>Not logged in</div>;

  return <div>Welcome, {session.user.name}!</div>;
}`;

const signInCode = `// Email/password sign in
const { data, error } = await authClient.signIn.email({
  email: 'user@example.com',
  password: 'password123',
});

// OAuth sign in
await authClient.signIn.social({ provider: 'google' });`;

export default async function ClientHomePage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl px-4 py-12">
        {/* Hero */}
        <div className="mb-10">
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-md bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-700 ring-1 ring-inset ring-cyan-500/20 dark:text-cyan-400">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
            Client-Side
          </span>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            React Hooks & UI Components
          </h1>
          <p className="mt-3 text-base text-zinc-600 dark:text-zinc-400">
            Pre-built React components and hooks for authentication.
            Works with client-side rendering.
          </p>
        </div>

        {/* Navigation */}
        <div className="mb-10 flex flex-wrap gap-2">
          <Link
            href="/client/auth/sign-in"
            className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800 dark:hover:bg-zinc-800"
          >
            <svg className="h-4 w-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            Authentication
          </Link>
          <Link
            href="/client/account"
            className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800 dark:hover:bg-zinc-800"
          >
            <svg className="h-4 w-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            Account
          </Link>
          <Link
            href="/client/organization"
            className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800 dark:hover:bg-zinc-800"
          >
            <svg className="h-4 w-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
            Organizations
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
                Create the auth client:
              </p>
              <CodeBlock code={setupCode} filename="lib/auth/client.ts" />
            </div>
            <div>
              <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
                Use in your components:
              </p>
              <CodeBlock code={usageCode} filename="app/page.tsx" />
            </div>
          </div>
        </section>

        {/* API Example */}
        <section className="mb-10">
          <h2 className="mb-5 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Authentication
          </h2>
          <CodeBlock code={signInCode} filename="example.ts" />
        </section>

        {/* Features */}
        <section>
          <h2 className="mb-5 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Features
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100">React Hooks</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                useSession, useOrganization for reactive state.
              </p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Pre-built UI</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Sign-in, sign-up, account management components.
              </p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100">OAuth Providers</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Google, GitHub, Discord, and more.
              </p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Type Safe</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Full TypeScript support with auto-completion.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
