type ServerData = {
  serverTime: string
  serverTimezone: string
  dayOfWeek: string
  isWeekend: boolean
}

interface ServerTimeCardProps {
  serverData: Pick<ServerData, 'serverTime' | 'serverTimezone' | 'dayOfWeek' | 'isWeekend'>
}

export function ServerTimeCard({ serverData }: ServerTimeCardProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Server Time
        </h2>
        <svg
          className="h-5 w-5 text-zinc-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <div className="space-y-3">
        <div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Current Day</p>
          <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {serverData.dayOfWeek}
            {serverData.isWeekend && (
              <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                Weekend!
              </span>
            )}
          </p>
        </div>
        <div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Rendered At</p>
          <p className="mt-1 font-mono text-sm text-zinc-900 dark:text-zinc-50">
            {new Date(serverData.serverTime).toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Server Timezone</p>
          <p className="mt-1 font-mono text-sm text-zinc-900 dark:text-zinc-50">
            {serverData.serverTimezone}
          </p>
        </div>
      </div>
    </div>
  )
}

