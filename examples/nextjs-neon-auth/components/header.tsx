"use client"

// import { UserButton } from "@daveyplate/better-auth-ui"
import { UserButton } from "@neondatabase/auth/react/ui"
import Link from "next/link"

import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"

export function Header() {
    const { data: session } = authClient.useSession()

    return (
        <header className="sticky top-0 z-50 flex h-12 justify-between border-b bg-background/60 px-4 backdrop-blur md:h-14 md:px-6">
            <div className="flex items-center gap-6">
                <Link href="/" className="flex items-center gap-2">
                    <svg
                        className="size-5 text-primary"
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                        <path d="M20 3v4" />
                        <path d="M22 5h-4" />
                        <path d="M4 17v2" />
                        <path d="M5 18H3" />
                    </svg>
                    <span className="hidden sm:inline font-semibold">Notely</span>
                </Link>
                {session && (
                    <nav className="flex items-center gap-1">
                        <Link href="/dashboard">
                            <Button variant="ghost" size="sm">
                                Dashboard
                            </Button>
                        </Link>
                        <Link href="/quote">
                            <Button variant="ghost" size="sm">
                                Quote
                            </Button>
                        </Link>
                        <Link href="/notes">
                            <Button variant="ghost" size="sm">
                                Notes
                            </Button>
                        </Link>
                    </nav>
                )}
            </div>

            <div className="flex items-center gap-2">
                <Link
                    href="https://github.com/neondatabase/neon-auth-nextjs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                    <svg
                        className="size-5"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                    <span className="sr-only">GitHub</span>
                </Link>
                <ModeToggle />
                <UserButton size="icon" />
            </div>
        </header>
    )
}