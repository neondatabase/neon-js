export function PageHeader() {
  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 md:text-4xl">
          Quote of the Day
        </h1>
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
          Server Component
        </span>
      </div>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Get inspired with a fresh quote every hour. This page demonstrates server-side rendering - fetching data and reading cookies with zero client-side JavaScript!
      </p>
    </div>
  )
}

