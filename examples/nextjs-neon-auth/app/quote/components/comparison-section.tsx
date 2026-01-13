export function ComparisonSection() {
  return (
    <div className="mt-8 grid gap-6 md:grid-cols-2">
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 dark:border-green-900 dark:bg-green-950/30">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
            Server Components
          </h3>
        </div>
        <ul className="space-y-2 text-sm text-green-800 dark:text-green-200">
          <li className="flex items-start gap-2">
            <span className="mt-0.5">✓</span>
            <span>Data fetching happens on the server</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5">✓</span>
            <span>No client-side JavaScript bundle</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5">✓</span>
            <span>Direct access to backend resources</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5">✓</span>
            <span>Better SEO with pre-rendered content</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5">✓</span>
            <span>Automatic code splitting</span>
          </li>
        </ul>
      </div>

      <div className="rounded-lg border border-orange-200 bg-orange-50 p-6 dark:border-orange-900 dark:bg-orange-950/30">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500">
            <span className="text-sm font-bold text-white">JS</span>
          </div>
          <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100">
            Client Components
          </h3>
        </div>
        <ul className="space-y-2 text-sm text-orange-800 dark:text-orange-200">
          <li className="flex items-start gap-2">
            <span className="mt-0.5">•</span>
            <span>Requires &ldquo;use client&rdquo; directive</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5">•</span>
            <span>JavaScript sent to browser</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5">•</span>
            <span>Can use hooks like useState, useEffect</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5">•</span>
            <span>Needed for interactivity and event handlers</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5">•</span>
            <span>Data fetching happens in browser</span>
          </li>
        </ul>
      </div>
    </div>
  )
}

