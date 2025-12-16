import { authServer } from '@/lib/auth/server';
import Link from 'next/link';

export default async function ServerRenderedPage() {
  const sessionResult = await authServer.getSession();
  const accountsResult = await authServer.listAccounts();

  return (
    <div className="min-h-screen bg-zinc-50 p-8 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Server Auth Test 
          </h1>
          <Link
            href="/"
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            ← Back to Home
          </Link>
        </div>

        <div className="space-y-6">
          {/* Session Result */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              authServer.getSession()
            </h2>
            <pre className="overflow-auto rounded-lg bg-zinc-100 p-4 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
              {JSON.stringify(sessionResult, null, 2)}
            </pre>
          </div>

          {/* Accounts Result (only if logged in) */}
          {sessionResult.data?.session && (
            <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                authServer.listAccounts()
              </h2>
              <pre className="overflow-auto rounded-lg bg-zinc-100 p-4 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                {JSON.stringify(accountsResult, null, 2)}
              </pre>
            </div>
          )}

          {/* Status */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Status
            </h2>
            <div className="flex items-center gap-2">
              <span
                className={`h-3 w-3 rounded-full ${
                  sessionResult.data?.session ? 'bg-green-500' : 'bg-yellow-500'
                }`}
              />
              <span className="text-zinc-700 dark:text-zinc-300">
                {sessionResult.data?.session
                  ? `Logged in as ${sessionResult.data.user?.email || sessionResult.data.user?.name}`
                  : 'Not logged in'}
              </span>
            </div>
            {!sessionResult.data?.session && (
              <Link
                href="/auth/sign-in"
                className="mt-4 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Sign In to test more APIs
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
