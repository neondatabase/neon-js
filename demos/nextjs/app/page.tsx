import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 font-sans dark:from-zinc-950 dark:to-black">
      <main className="flex w-full max-w-4xl flex-col items-center justify-center gap-8 px-6 py-20">
        <div className="flex flex-col items-center gap-6 text-center">
          <h1 className="text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-6xl">
            Neon Auth
          </h1>
          <p className="max-w-2xl text-xl leading-relaxed text-zinc-600 dark:text-zinc-400">
            Serverless authentication for modern applications. Built on top of{" "}
            <a
              href="https://better-auth.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-zinc-900 underline decoration-zinc-300 transition-colors hover:decoration-zinc-900 dark:text-zinc-100 dark:decoration-zinc-600 dark:hover:decoration-zinc-100"
            >
              Better Auth
            </a>
            , powered by{" "}
            <a
              href="https://neon.tech"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-zinc-900 underline decoration-zinc-300 transition-colors hover:decoration-zinc-900 dark:text-zinc-100 dark:decoration-zinc-600 dark:hover:decoration-zinc-100"
            >
              Neon
            </a>
            &apos;s serverless Postgres.
          </p>
          <p className="max-w-xl text-base leading-relaxed text-zinc-500 dark:text-zinc-500">
            Get started with secure, scalable authentication in minutes. No complex setup, no infrastructure management—just plug in and authenticate.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            href="/auth/sign-in"
            className="flex h-12 items-center justify-center rounded-lg bg-zinc-900 px-8 text-base font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Get Started
          </Link>
          <Link
            href="/dashboard"
            className="flex h-12 items-center justify-center rounded-lg border border-zinc-300 bg-transparent px-8 text-base font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-900"
          >
            View Dashboard
          </Link>
          <Link
            href="/quote"
            className="flex h-12 items-center justify-center rounded-lg border border-zinc-300 bg-transparent px-8 text-base font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-900"
          >
            Quote of the Day
          </Link>
        </div>

        <div className="mt-8 grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Serverless First</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Built for serverless environments with Neon&apos;s autoscaling Postgres.
            </p>
          </div>
          <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Better Auth Core</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Leverage the full power of Better Auth&apos;s flexible authentication framework.
            </p>
          </div>
          <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Zero Config</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Start authenticating users with minimal setup and configuration.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
