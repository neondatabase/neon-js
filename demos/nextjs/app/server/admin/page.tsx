import { authServer } from '@/lib/auth/server';
import Link from 'next/link';
import { CodeBlock } from '@/components/code-block';

const listUsersCode = `import { authServer } from '@/lib/auth/server';

export default async function AdminPage() {
  const { data: users, error } = await authServer.admin.listUsers({
    query: { limit: 10 },
  });

  if (error) {
    return <div>Not authorized</div>;
  }

  return (
    <ul>
      {users?.map((user) => (
        <li key={user.id}>
          {user.email} - {user.role}
        </li>
      ))}
    </ul>
  );
}`;

const createUserCode = `'use server';

import { authServer } from '@/lib/auth/server';

export async function createUser(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const name = formData.get('name') as string;

  const { data, error } = await authServer.admin.createUser({
    email,
    password,
    name,
    role: 'user',
  });

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, data };
}`;

const banUserCode = `'use server';

import { authServer } from '@/lib/auth/server';

export async function banUser(userId: string) {
  const { data, error } = await authServer.admin.banUser({
    userId,
    banReason: 'Violated terms of service',
    banExpiresIn: 60 * 60 * 24 * 7, // 7 days
  });

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true };
}

export async function unbanUser(userId: string) {
  const { data, error } = await authServer.admin.unbanUser({
    userId,
  });

  return { success: !error };
}`;

const otherApisCode = `// Set user role
await authServer.admin.setRole({
  userId: 'user_123',
  role: 'admin',
});

// Set user password
await authServer.admin.setUserPassword({
  userId: 'user_123',
  newPassword: 'newPassword123',
});

// Impersonate user
await authServer.admin.impersonateUser({
  userId: 'user_123',
});

// Stop impersonating
await authServer.admin.stopImpersonating();

// List user sessions
const { data } = await authServer.admin.listUserSessions({
  userId: 'user_123',
});

// Revoke all user sessions
await authServer.admin.revokeUserSessions({
  userId: 'user_123',
});`;

export default async function ServerAdminPage() {
  const sessionResult = await authServer.getSession();
  const session = sessionResult.data;
  const isLoggedIn = !!session?.session;

  let usersResult: { data: unknown; error: unknown } = { data: null, error: null };
  if (isLoggedIn) {
    usersResult = await authServer.admin.listUsers({ query: { limit: 10 } });
  }

  const isAdmin = !usersResult.error && usersResult.data;

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
              Sign in to access admin features.
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

  if (!isAdmin) {
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
            Admin
          </h1>
          <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            Server-side admin APIs
          </p>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg bg-red-50 p-5 ring-1 ring-red-200 dark:bg-red-950/30 dark:ring-red-900">
              <h2 className="font-semibold text-red-800 dark:text-red-200">
                Admin Access Required
              </h2>
              <p className="mt-2 text-sm text-red-700 dark:text-red-300">
                You don&apos;t have admin privileges. Admin APIs require the &quot;admin&quot; role.
              </p>
              <div className="mt-3 rounded-md bg-red-100 p-2 dark:bg-red-900/40">
                <code className="text-xs text-red-800 dark:text-red-200">
                  {(usersResult.error as { message?: string })?.message || 'Unauthorized'}
                </code>
              </div>
            </div>
            <CodeBlock code={listUsersCode} filename="app/admin/page.tsx" />
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
          Admin
        </h1>
        <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          Server-side admin APIs
        </p>

        <div className="mt-8 space-y-12">
          {/* List Users Section */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                List Users
              </h2>
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                authServer.admin.listUsers()
              </code>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                <h3 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Result
                </h3>
                {Array.isArray(usersResult.data) && usersResult.data.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 dark:border-zinc-700">
                          <th className="pb-2 text-left font-medium text-zinc-500">Email</th>
                          <th className="pb-2 text-left font-medium text-zinc-500">Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(usersResult.data as Array<{
                          id: string;
                          email: string;
                          name?: string;
                          role?: string;
                        }>).map((user) => (
                          <tr key={user.id} className="border-b border-zinc-100 dark:border-zinc-800">
                            <td className="py-2 text-zinc-900 dark:text-zinc-100">
                              {user.email}
                            </td>
                            <td className="py-2">
                              <span className={`rounded px-1.5 py-0.5 text-xs ${
                                user.role === 'admin'
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                                  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                              }`}>
                                {user.role || 'user'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">No users found</p>
                )}
              </div>
              <CodeBlock code={listUsersCode} filename="app/admin/page.tsx" />
            </div>
          </section>

          {/* Create User Section */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Create User
              </h2>
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                authServer.admin.createUser()
              </code>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                <h3 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Parameters
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex gap-3">
                    <code className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">email</code>
                    <span className="text-zinc-600 dark:text-zinc-400">User&apos;s email address</span>
                  </li>
                  <li className="flex gap-3">
                    <code className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">password</code>
                    <span className="text-zinc-600 dark:text-zinc-400">Initial password</span>
                  </li>
                  <li className="flex gap-3">
                    <code className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">name</code>
                    <span className="text-zinc-600 dark:text-zinc-400">Display name (optional)</span>
                  </li>
                  <li className="flex gap-3">
                    <code className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">role</code>
                    <span className="text-zinc-600 dark:text-zinc-400">User role (user, admin)</span>
                  </li>
                </ul>
              </div>
              <CodeBlock code={createUserCode} filename="actions.ts" />
            </div>
          </section>

          {/* Ban/Unban User Section */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Ban / Unban User
              </h2>
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                authServer.admin.banUser()
              </code>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                <h3 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Parameters
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex gap-3">
                    <code className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">userId</code>
                    <span className="text-zinc-600 dark:text-zinc-400">User to ban/unban</span>
                  </li>
                  <li className="flex gap-3">
                    <code className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">banReason</code>
                    <span className="text-zinc-600 dark:text-zinc-400">Reason for ban (optional)</span>
                  </li>
                  <li className="flex gap-3">
                    <code className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">banExpiresIn</code>
                    <span className="text-zinc-600 dark:text-zinc-400">Ban duration in seconds</span>
                  </li>
                </ul>
              </div>
              <CodeBlock code={banUserCode} filename="actions.ts" />
            </div>
          </section>

          {/* Other APIs Section */}
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Other APIs
              </h2>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                <h3 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Available methods
                </h3>
                <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
                  {[
                    'setRole()',
                    'setUserPassword()',
                    'updateUser()',
                    'removeUser()',
                    'impersonateUser()',
                    'stopImpersonating()',
                    'listUserSessions()',
                    'revokeUserSession()',
                    'revokeUserSessions()',
                    'hasPermission()',
                  ].map((api) => (
                    <li key={api}>
                      <code className="text-xs text-zinc-600 dark:text-zinc-400">
                        .{api}
                      </code>
                    </li>
                  ))}
                </ul>
              </div>
              <CodeBlock code={otherApisCode} filename="examples.ts" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
