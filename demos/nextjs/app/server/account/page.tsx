import { authServer } from '@/lib/auth/server';
import Link from 'next/link';
import { UpdateUserForm } from './update-user-form';
import { LinkedAccountsSection } from './linked-accounts';
import { ChangePasswordForm } from './change-password-form';
import { CodeBlock } from '@/components/code-block';

const getSessionCode = `import { authServer } from '@/lib/auth/server';

export default async function Page() {
  const { data, error } = await authServer.getSession();

  if (!data?.session) {
    return <div>Not logged in</div>;
  }

  return <div>Welcome, {data.user.name}</div>;
}`;

const updateUserCode = `'use server';

import { authServer } from '@/lib/auth/server';
import { revalidatePath } from 'next/cache';

export async function updateUserName(formData: FormData) {
  const name = formData.get('name') as string;

  const { data, error } = await authServer.updateUser({ name });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath('/server/account');
  return { success: true, message: 'Name updated!' };
}`;

const listAccountsCode = `import { authServer } from '@/lib/auth/server';

// List all linked accounts
const { data: accounts } = await authServer.listAccounts();

// Get detailed info for a specific account
const { data: info } = await authServer.accountInfo({
  query: { accountId: 'account_123' },
});`;

const changePasswordCode = `'use server';

import { authServer } from '@/lib/auth/server';

export async function changePassword(formData: FormData) {
  const currentPassword = formData.get('currentPassword') as string;
  const newPassword = formData.get('newPassword') as string;

  const { data, error } = await authServer.changePassword({
    currentPassword,
    newPassword,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, message: 'Password changed!' };
}`;

export default async function ServerAccountPage() {
  const sessionResult = await authServer.getSession();
  const accountsResult = await authServer.listAccounts();

  const session = sessionResult.data;
  const isLoggedIn = !!session?.session;

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="mx-auto max-w-4xl px-4 py-12">
          <Link
            href="/server"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </Link>
          <div className="rounded-lg bg-amber-50 p-6 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:ring-amber-900">
            <p className="text-amber-800 dark:text-amber-200">
              Sign in to view account information.
            </p>
            <Link
              href="/server/auth/sign-in"
              className="mt-4 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <Link
          href="/server"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </Link>

        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Account
        </h1>
        <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          Server-side account management APIs
        </p>

        <div className="mt-8 space-y-12">
          {/* Get Session Section */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Get Session
              </h2>
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                authServer.getSession()
              </code>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                <h3 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Result
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex gap-3">
                    <span className="w-20 shrink-0 text-zinc-500">ID</span>
                    <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
                      {session.user?.id}
                    </code>
                  </div>
                  <div className="flex gap-3">
                    <span className="w-20 shrink-0 text-zinc-500">Email</span>
                    <span className="text-zinc-900 dark:text-zinc-100">
                      {session.user?.email}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <span className="w-20 shrink-0 text-zinc-500">Name</span>
                    <span className="text-zinc-900 dark:text-zinc-100">
                      {session.user?.name || '—'}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <span className="w-20 shrink-0 text-zinc-500">Verified</span>
                    <span className="text-zinc-900 dark:text-zinc-100">
                      {session.user?.emailVerified ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>
              <CodeBlock code={getSessionCode} filename="app/page.tsx" />
            </div>
          </section>

          {/* Update User Section */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Update User
              </h2>
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                authServer.updateUser()
              </code>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                <h3 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Try it
                </h3>
                <UpdateUserForm currentName={session.user?.name || ''} />
              </div>
              <CodeBlock code={updateUserCode} filename="actions.ts" />
            </div>
          </section>

          {/* List Accounts Section */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Linked Accounts
              </h2>
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                authServer.listAccounts()
              </code>
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                authServer.accountInfo()
              </code>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                <h3 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Result <span className="font-normal">(click to expand)</span>
                </h3>
                <LinkedAccountsSection
                  accounts={accountsResult.data?.map((a) => ({
                    id: a.id,
                    providerId: a.providerId,
                    accountId: a.accountId,
                  })) || []}
                />
              </div>
              <CodeBlock code={listAccountsCode} filename="accounts.ts" />
            </div>
          </section>

          {/* Change Password Section */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Change Password
              </h2>
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                authServer.changePassword()
              </code>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                <h3 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Try it
                </h3>
                <ChangePasswordForm />
              </div>
              <CodeBlock code={changePasswordCode} filename="actions.ts" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
