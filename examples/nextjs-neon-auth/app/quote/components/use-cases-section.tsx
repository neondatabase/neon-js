import { neonAuth } from "@neondatabase/auth/next"

export async function UseCasesSection() {
  const { user } = await neonAuth()

  return (
    <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Real-World Use Cases for {user?.name}
      </h2>
      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <svg
              className="h-5 w-5 text-blue-600 dark:text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
              />
            </svg>
          </div>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
            Database Queries
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Directly query your Neon Postgres database without exposing connection strings
            to the client.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
            <svg
              className="h-5 w-5 text-green-600 dark:text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
            Cookie & Session Access
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Read cookies and session data directly on the server - perfect for auth checks
            and personalized content.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
            <svg
              className="h-5 w-5 text-purple-600 dark:text-purple-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
            Fast Initial Load
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Pre-render content on the server for instant page loads with fully populated
            data - no loading spinners!
          </p>
        </div>
      </div>
    </div>
  )
}

