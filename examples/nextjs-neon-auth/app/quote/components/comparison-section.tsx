export function ComparisonSection() {
  return (
    <div className="mt-8 grid gap-6 md:grid-cols-2">
      <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-6">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-green-700 dark:text-green-300">
            Server Components
          </h3>
        </div>
        <ul className="space-y-2 text-sm text-green-700 dark:text-green-300">
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

      <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-6">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-white">
            <span className="text-sm font-bold">JS</span>
          </div>
          <h3 className="text-lg font-semibold text-orange-700 dark:text-orange-300">
            Client Components
          </h3>
        </div>
        <ul className="space-y-2 text-sm text-orange-700 dark:text-orange-300">
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
