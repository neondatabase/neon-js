export function PageHeader() {
  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Quote of the Day
        </h1>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          Server Component
        </span>
      </div>
      <p className="mt-2 text-muted-foreground">
        Get inspired with a fresh quote every hour. This page demonstrates server-side rendering - fetching data and reading cookies with zero client-side JavaScript!
      </p>
    </div>
  )
}
