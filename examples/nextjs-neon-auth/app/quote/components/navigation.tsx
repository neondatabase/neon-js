import Link from "next/link"
import { Button } from "@/components/ui/button"

export function Navigation() {
  return (
    <div className="mt-8 flex gap-4">
      <Link href="/">
        <Button variant="outline">
          ← Back to Home
        </Button>
      </Link>
      <Link href="/dashboard">
        <Button variant="outline">
          View Dashboard
        </Button>
      </Link>
    </div>
  )
}

