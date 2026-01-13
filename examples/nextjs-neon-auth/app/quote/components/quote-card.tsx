import { neonAuth } from '@neondatabase/auth/next/server';

type Quote = {
  content: string;
  author: string;
  tags: string[];
};

interface QuoteCardProps {
  quote: Quote;
}

export async function QuoteCard({ quote }: QuoteCardProps) {
  const { session, user } = await neonAuth();
  const isLoggedIn = !!session && !!user;

  return (
    <div className="mb-8 rounded-lg border bg-primary/5 p-8 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <svg
          className="h-5 w-5 text-primary"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
        <h2 className="text-lg font-semibold text-foreground">
          Quote of the Day
        </h2>
      </div>
      <blockquote className="mt-4 text-xl italic text-foreground/80">
        &ldquo;{quote.content}&rdquo;
      </blockquote>
      <p className="mt-3 text-right text-sm font-medium text-muted-foreground">
        — {quote.author}
      </p>
      {quote.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {quote.tags.slice(0, 3).map((tag: string) => (
            <span
              key={tag}
              className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
