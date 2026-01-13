type ServerData = {
  requestId: string
  environment: string
}

interface ServerInfoCardProps {
  serverData: Pick<ServerData, 'requestId' | 'environment'>
}

export function ServerInfoCard({ serverData }: ServerInfoCardProps) {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          Server Info
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
            d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
          />
        </svg>
      </div>
      <div className="space-y-3">
        <div>
          <p className="text-sm text-muted-foreground">Request ID</p>
          <p className="mt-1 font-mono text-sm text-foreground">
            {serverData.requestId}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Environment</p>
          <div className="mt-1 flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${serverData.environment === 'production' ? 'bg-green-500' : 'bg-primary'}`} />
            <p className="font-medium text-foreground capitalize">
              {serverData.environment}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-xs text-muted-foreground">Features</p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            <li className="flex items-center gap-1">
              <span className="text-green-500">✓</span> Zero client JS
            </li>
            <li className="flex items-center gap-1">
              <span className="text-green-500">✓</span> Server-side rendering
            </li>
            <li className="flex items-center gap-1">
              <span className="text-green-500">✓</span> Parallel data fetching
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
