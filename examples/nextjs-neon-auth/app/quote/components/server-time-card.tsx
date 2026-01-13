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
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          Server Time
        </h2>
        <svg
          className="h-5 w-5 text-muted-foreground"
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
          <p className="text-sm text-muted-foreground">Current Day</p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {serverData.dayOfWeek}
            {serverData.isWeekend && (
              <span className="ml-2 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                Weekend!
              </span>
            )}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Rendered At</p>
          <p className="mt-1 font-mono text-sm text-foreground">
            {new Date(serverData.serverTime).toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Server Timezone</p>
          <p className="mt-1 font-mono text-sm text-foreground">
            {serverData.serverTimezone}
          </p>
        </div>
      </div>
    </div>
  )
}
