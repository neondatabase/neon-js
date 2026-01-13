import {
  QuoteCard,
  SessionCard,
  ServerTimeCard,
  ServerInfoCard,
  UseCasesSection,
  ComparisonSection,
  PageHeader,
  Navigation,
} from "./components"

// This is a Server Component (no "use client" directive)
// It can directly fetch data, access databases, read files, etc.

// Fetch real data from external API
async function getQuoteOfTheDay() {
  try {
    const res = await fetch("https://api.quotable.io/random", {
      next: { revalidate: 3600 }, // Cache for 1 hour
    })
    if (!res.ok) throw new Error("Failed to fetch quote")
    const data = await res.json()
    return {
      content: data.content,
      author: data.author,
      tags: data.tags,
    }
  } catch {
    return {
      content: "The only way to do great work is to love what you do.",
      author: "Steve Jobs",
      tags: ["inspirational"],
    }
  }
}

// Server-only computation
function analyzeData() {
  const serverTime = new Date()
  return {
    serverTime: serverTime.toISOString(),
    requestId: Math.random().toString(36).substring(7),
    environment: process.env.NODE_ENV || "development",
    serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dayOfWeek: serverTime.toLocaleDateString("en-US", { weekday: "long" }),
    isWeekend: serverTime.getDay() === 0 || serverTime.getDay() === 6,
  }
}

export default async function QuotePage() {
  // All data fetching happens in parallel on the server
  const [quote, serverData] = await Promise.all([
    getQuoteOfTheDay(),
    Promise.resolve(analyzeData()),
  ])

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-zinc-50 dark:bg-zinc-950">
      <div className="container mx-auto px-4 py-8 md:px-6 md:py-12">
        <PageHeader />

        <QuoteCard quote={quote} />

        {/* Data Display Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <SessionCard />
          <ServerTimeCard serverData={serverData} />
          <ServerInfoCard serverData={serverData} />
        </div>

        <UseCasesSection />
        <ComparisonSection />
        <Navigation />
      </div>
    </div>
  )
}
