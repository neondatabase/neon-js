import { authServer } from '@/lib/auth/server';
import { SignUpForm } from './sign-up-form';
import { CodeBlock } from '@/components/code-block';
import Link from 'next/link';

const signUpCode = `'use server';

import { authServer } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export async function signUpWithEmail(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const { error } = await authServer.signUp.email({
    name,
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect('/server');
}`;

export default async function SignUpPage() {
  const sessionResult = await authServer.getSession();
  const session = sessionResult?.data;
  const isLoggedIn = !!session?.session;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <Link
          href="/server"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </Link>

        <div className="grid gap-10 lg:grid-cols-2">
          {/* Form */}
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Create Account
            </h1>
            <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
              Using{' '}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs dark:bg-zinc-800">
                authServer.signUp.email()
              </code>
            </p>

            {isLoggedIn ? (
              <div className="mt-6 rounded-lg bg-green-50 p-6 ring-1 ring-green-200 dark:bg-green-950/30 dark:ring-green-900">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                    <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-200">
                      You&apos;re already signed in
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      {session.user?.email}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex gap-3">
                  <Link
                    href="/server"
                    className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
                  >
                    Go to Dashboard
                  </Link>
                  <Link
                    href="/server/account"
                    className="rounded-md bg-white px-4 py-2 text-sm font-medium text-green-700 ring-1 ring-green-300 hover:bg-green-50 dark:bg-green-950 dark:text-green-300 dark:ring-green-800 dark:hover:bg-green-900"
                  >
                    View Account
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-6 rounded-lg bg-white p-6 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                  <SignUpForm />
                </div>

                <p className="mt-4 text-center text-sm text-zinc-600 dark:text-zinc-400">
                  Already have an account?{' '}
                  <Link
                    href="/server/auth/sign-in"
                    className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                  >
                    Sign in
                  </Link>
                </p>
              </>
            )}
          </div>

          {/* Code */}
          <div>
            <h2 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Server Action
            </h2>
            <CodeBlock code={signUpCode} filename="actions.ts" />

            <div className="mt-6 rounded-lg bg-white p-4 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                How it works
              </h3>
              <ol className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">1</span>
                  Form submits name, email, password
                </li>
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">2</span>
                  <code className="text-xs">authServer.signUp.email()</code> creates user
                </li>
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">3</span>
                  User automatically signed in
                </li>
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">4</span>
                  Redirect to dashboard
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
