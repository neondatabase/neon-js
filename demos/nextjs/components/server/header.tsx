import Link from "next/link"
import { authServer } from "@/lib/auth/server"
import { ServerHeaderNav } from "./header-nav"
import { ModeToggle } from "@/components/mode-toggle"
import { UserButton } from "./user-button"

export async function Header() {
    const session = await authServer.getSession()
    const isLoggedIn = !!session?.data?.session
    const user = session?.data?.user ? {
        name: session.data.user.name,
        email: session.data.user.email,
        image: session.data.user.image ?? null,
    } : null

    return (
        <header className="sticky top-0 z-50 flex h-12 justify-between border-b bg-background/60 px-4 backdrop-blur md:h-14 md:px-6">
            <div className="flex items-center gap-6">
                <Link href="/" className="flex items-center gap-2">
                    <svg width="20" height="20" viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.55 46H7.1l-.3-.08A7.9 7.9 0 0 1 0 37.95V8c0-4.5 3.5-8 8.01-8h30.04c3.86 0 7.1 2.7 7.83 6.5L46 7v27.31c-.04.12-.08.23-.1.34a4.6 4.6 0 0 1-3.75 3.57 4.51 4.51 0 0 1-4.74-1.83l-8.16-10.49-.3-.35-.12.05v12.95c-.01 2.74-1.12 4.89-3.43 6.4-.87.55-1.85.81-2.85 1.04Zm16.96-17.3.1-.06.02-.4V7.5c0-.96-.17-1.11-1.13-1.11H8.32c-1.4 0-1.94.53-1.95 1.92v29.46c0 1.33.56 1.87 1.9 1.87H21.1c1.32 0 1.34-.01 1.34-1.32 0-5.9-.02-11.8 0-17.7a4.76 4.76 0 0 1 6.31-4.46 5.48 5.48 0 0 1 2.56 2.04l7.85 10.1c.1.14.23.27.34.4Z" fill="currentColor"/></svg>
                    <span className="hidden sm:inline font-semibold">Neon Auth</span>
                </Link>

                <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-500/20 dark:text-amber-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Server
                </span>

                <ServerHeaderNav isLoggedIn={isLoggedIn} />
            </div>

            <div className="flex items-center gap-2">
                <Link
                    href="https://github.com/neondatabase/neon-js/tree/main/demos/nextjs"
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
                <UserButton user={user} isLoggedIn={isLoggedIn} />
            </div>
        </header>
    )
}
