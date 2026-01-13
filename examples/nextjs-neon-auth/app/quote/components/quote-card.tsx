import { neonAuth } from "@neondatabase/auth/next"

type Quote = {
  content: string
  author: string
  tags: string[]
}

interface QuoteCardProps {
  quote: Quote
}

export async function QuoteCard({ quote }: QuoteCardProps) {
  console.log("quote card.... ")
  const { session, user } = await neonAuth()
  const isLoggedIn = !!session && !!user
  console.log("quote card.... ", isLoggedIn, session?.id, user?.email)
  
  return (
    <div className="mb-8 rounded-lg border border-zinc-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-8 shadow-sm dark:border-zinc-800 dark:from-blue-950/30 dark:to-indigo-950/30">
      <div className="mb-2 flex items-center gap-2">
        <svg
          className="h-5 w-5 text-blue-600 dark:text-blue-400"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Quote of the Day
        </h2>
      </div>
      <blockquote className="mt-4 text-xl italic text-zinc-700 dark:text-zinc-300">
        &ldquo;{quote.content}&rdquo;
      </blockquote>
      <p className="mt-3 text-right text-sm font-medium text-zinc-600 dark:text-zinc-400">
        — {quote.author}
      </p>
      {quote.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {quote.tags.slice(0, 3).map((tag: string) => (
            <span
              key={tag}
              className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

