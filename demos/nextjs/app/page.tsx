import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-zinc-950">
      <main className="flex w-full max-w-4xl flex-col items-center justify-center gap-8 px-6 py-20">
        <div className="flex flex-col items-center gap-6 text-center">
          <h1 className="text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-6xl">
            Neon Auth
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
            Serverless authentication for modern applications. Built on{' '}
            <a
              href="https://better-auth.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 transition-colors hover:decoration-zinc-500 dark:text-zinc-100 dark:decoration-zinc-600 dark:hover:decoration-zinc-400"
            >
              Better Auth
            </a>
            , powered by{' '}
            <a
              href="https://neon.tech"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 transition-colors hover:decoration-zinc-500 dark:text-zinc-100 dark:decoration-zinc-600 dark:hover:decoration-zinc-400"
            >
              Neon
            </a>
            .
          </p>
        </div>

        {/* API Selection */}
        <div className="mt-4 grid w-full max-w-2xl gap-4 sm:grid-cols-2">
          <Link
            href="/client"
            className="group rounded-lg bg-white p-6 shadow-sm ring-1 ring-zinc-200 transition-all hover:shadow-md hover:ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-800 dark:hover:ring-zinc-700"
          >
            <div className="mb-4 flex items-center gap-3">
              <span className="inline-flex items-center gap-1 rounded-md bg-cyan-500/10 px-2 py-0.5 text-xs font-medium text-cyan-700 ring-1 ring-inset ring-cyan-500/20 dark:text-cyan-400">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                Client
              </span>
            </div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              React Hooks & UI
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Pre-built components, useSession hook, and client-side authentication.
            </p>
            <div className="mt-4 flex items-center gap-1 text-sm font-medium text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100">
              Explore
              <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </div>
          </Link>

          <Link
            href="/server"
            className="group rounded-lg bg-white p-6 shadow-sm ring-1 ring-zinc-200 transition-all hover:shadow-md hover:ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-800 dark:hover:ring-zinc-700"
          >
            <div className="mb-4 flex items-center gap-3">
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-500/20 dark:text-amber-400">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Server
              </span>
            </div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Server Components & Actions
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              RSC support, Server Actions, admin APIs, and automatic cookie handling.
            </p>
            <div className="mt-4 flex items-center gap-1 text-sm font-medium text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100">
              Explore
              <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </div>
          </Link>
        </div>

        {/* Features */}
        <div className="mt-6 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
              Serverless First
            </h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Built for serverless with Neon&apos;s autoscaling Postgres.
            </p>
          </div>
          <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
              Better Auth Core
            </h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Full power of Better Auth&apos;s flexible framework.
            </p>
          </div>
          <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
              Zero Config
            </h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Minimal setup to start authenticating users.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
