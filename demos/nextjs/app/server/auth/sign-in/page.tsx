import { authServer } from '@/lib/auth/server';
import { SignInForm } from './sign-in-form';
import { OtpSignInForm } from './otp-sign-in-form';
import { GoogleSignInButton } from './google-sign-in-button';
import { SignOutButton } from './sign-out-button';
import { CodeBlock } from '@/components/code-block';
import Link from 'next/link';

const signInCode = `'use server';

import { authServer } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export async function signInWithEmail(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const { error } = await authServer.signIn.email({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect('/server');
}`;

const sessionCheckCode = `// Check session in Server Components
import { neonAuth } from '@neondatabase/auth/next';

export default async function Page() {
  const { session, user } = await neonAuth();

  if (!session) {
    return <div>Not authenticated</div>;
  }

  return (
    <div>
      <p>Welcome, {user?.name}!</p>
      <p>Email: {user?.email}</p>
      <p>Session expires: {session.expiresAt}</p>
    </div>
  );
}`;

const otpSignInCode = `'use server';

import { authServer } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

// Step 1: Send OTP to email
export async function sendOtp(email: string) {
  const { error } = await authServer.emailOtp.sendVerificationOtp({
    email,
    type: 'sign-in',
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

// Step 2: Verify OTP and sign in
export async function verifyOtp(email: string, otp: string) {
  const { error } = await authServer.signIn.emailOtp({
    email,
    otp,
  });

  if (error) {
    return { error: error.message };
  }

  redirect('/server');
}`;

const googleSignInCode = `'use server';

import { authServer } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export async function signInWithGoogle() {
  const { data, error } = await authServer.signIn.social({
    provider: 'google',
    callbackURL: '/server',
  });

  if (error) {
    return { error: error.message };
  }

  // Redirect to Google OAuth
  if (data?.url) {
    redirect(data.url);
  }
}`;

const signOutCode = `'use server';

import { authServer } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export async function signOut() {
  await authServer.signOut();
  redirect('/server/auth/sign-in');
}`;

export default async function SignInPage() {
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

        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Authentication
        </h1>
        <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          Server-side authentication methods
        </p>

        <div className="mt-8 space-y-12">
          {/* Sign In with Email/Password */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Sign In with Email
              </h2>
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                authServer.signIn.email()
              </code>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                {isLoggedIn ? (
                  <div className="rounded-lg bg-green-50 p-4 ring-1 ring-green-200 dark:bg-green-950/30 dark:ring-green-900">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                        <svg className="h-4 w-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-green-800 dark:text-green-200">
                          Signed in as
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-300">
                          {session.user?.email}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Link
                        href="/server"
                        className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                      >
                        Dashboard
                      </Link>
                      <Link
                        href="/server/account"
                        className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-green-700 ring-1 ring-green-300 hover:bg-green-50 dark:bg-green-950 dark:text-green-300 dark:ring-green-800"
                      >
                        Account
                      </Link>
                    </div>
                  </div>
                ) : (
                  <>
                    <h3 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      Try it
                    </h3>
                    <SignInForm />
                    <p className="mt-4 text-center text-sm text-zinc-600 dark:text-zinc-400">
                      Don&apos;t have an account?{' '}
                      <Link
                        href="/server/auth/sign-up"
                        className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                      >
                        Sign up
                      </Link>
                    </p>
                  </>
                )}
              </div>
              <CodeBlock 
                code={isLoggedIn ? sessionCheckCode : signInCode} 
                filename={isLoggedIn ? 'page.tsx' : 'actions.ts'} 
              />
            </div>
          </section>

          {/* Sign In with OTP */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Sign In with OTP
              </h2>
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                authServer.signIn.emailOtp()
              </code>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                {isLoggedIn ? (
                  <div className="rounded-lg bg-green-50 p-4 ring-1 ring-green-200 dark:bg-green-950/30 dark:ring-green-900">
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Already signed in. Sign out to try OTP sign in.
                    </p>
                  </div>
                ) : (
                  <>
                    <h3 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      Try it
                    </h3>
                    <OtpSignInForm />
                  </>
                )}
              </div>
              <div>
                <CodeBlock code={otpSignInCode} filename="actions.ts" />
                <div className="mt-4 rounded-lg bg-amber-50 p-4 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:ring-amber-900">
                  <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    How it works
                  </h4>
                  <ol className="mt-2 space-y-1 text-xs text-amber-700 dark:text-amber-300">
                    <li>1. User enters email, OTP is sent</li>
                    <li>2. User enters the OTP code</li>
                    <li>3. Server verifies OTP and creates session</li>
                  </ol>
                </div>
              </div>
            </div>
          </section>

          {/* Sign In with Google */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Sign In with Google
              </h2>
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                authServer.signIn.social()
              </code>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                {isLoggedIn ? (
                  <div className="rounded-lg bg-green-50 p-4 ring-1 ring-green-200 dark:bg-green-950/30 dark:ring-green-900">
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Already signed in. Sign out to try Google sign in.
                    </p>
                  </div>
                ) : (
                  <>
                    <h3 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      Try it
                    </h3>
                    <GoogleSignInButton />
                  </>
                )}
              </div>
              <div>
                <CodeBlock code={googleSignInCode} filename="actions.ts" />
                <div className="mt-4 rounded-lg bg-blue-50 p-4 ring-1 ring-blue-200 dark:bg-blue-950/30 dark:ring-blue-900">
                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Supported providers
                  </h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {['google', 'github', 'vercel'].map((provider) => (
                      <span
                        key={provider}
                        className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                      >
                        {provider}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Sign Out */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Sign Out
              </h2>
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                authServer.signOut()
              </code>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                {isLoggedIn ? (
                  <>
                    <h3 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      Try it
                    </h3>
                    <div className="flex items-center gap-4">
                      <SignOutButton />
                      <p className="text-sm text-zinc-500">
                        Signed in as {session.user?.email}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg bg-zinc-50 p-4 ring-1 ring-zinc-200 dark:bg-zinc-800/50 dark:ring-zinc-700">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Sign in first to test sign out.
                    </p>
                  </div>
                )}
              </div>
              <div>
                <CodeBlock code={signOutCode} filename="actions.ts" />
                <div className="mt-4 rounded-lg bg-zinc-50 p-4 ring-1 ring-zinc-200 dark:bg-zinc-800/50 dark:ring-zinc-700">
                  <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    What happens
                  </h4>
                  <ul className="mt-2 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                    <li>• Session cookie is cleared</li>
                    <li>• Server-side session is invalidated</li>
                    <li>• User is redirected to sign-in page</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
