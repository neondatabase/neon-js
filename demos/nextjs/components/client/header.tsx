"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { authClient } from "@/lib/auth/client"
import { Button } from "@/components/ui/button"
import { HeaderActions } from "@/components/header-actions"

export function Header() {
    const { data: session } = authClient.useSession()
    const pathname = usePathname()

    return (
        <header className="sticky top-0 z-50 flex h-12 justify-between border-b bg-background/60 px-4 backdrop-blur md:h-14 md:px-6">
            <div className="flex items-center gap-6">
                <Link href="/" className="flex items-center gap-2">
                    <svg width="20" height="20" viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.55 46H7.1l-.3-.08A7.9 7.9 0 0 1 0 37.95V8c0-4.5 3.5-8 8.01-8h30.04c3.86 0 7.1 2.7 7.83 6.5L46 7v27.31c-.04.12-.08.23-.1.34a4.6 4.6 0 0 1-3.75 3.57 4.51 4.51 0 0 1-4.74-1.83l-8.16-10.49-.3-.35-.12.05v12.95c-.01 2.74-1.12 4.89-3.43 6.4-.87.55-1.85.81-2.85 1.04Zm16.96-17.3.1-.06.02-.4V7.5c0-.96-.17-1.11-1.13-1.11H8.32c-1.4 0-1.94.53-1.95 1.92v29.46c0 1.33.56 1.87 1.9 1.87H21.1c1.32 0 1.34-.01 1.34-1.32 0-5.9-.02-11.8 0-17.7a4.76 4.76 0 0 1 6.31-4.46 5.48 5.48 0 0 1 2.56 2.04l7.85 10.1c.1.14.23.27.34.4Z" fill="currentColor"/></svg>
                    <span className="hidden sm:inline font-semibold">Neon Auth</span>
                </Link>

                <span className="inline-flex items-center gap-1 rounded-md bg-cyan-500/10 px-2 py-0.5 text-xs font-medium text-cyan-700 ring-1 ring-inset ring-cyan-500/20 dark:text-cyan-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                    Client
                </span>

                <nav className="flex items-center gap-1">
                    <Link href="/client">
                        <Button variant={pathname === '/client' ? "secondary" : "ghost"} size="sm">
                            Home
                        </Button>
                    </Link>
                    {session && (
                        <>
                            <Link href="/client/account">
                                <Button variant={pathname.startsWith('/client/account') ? "secondary" : "ghost"} size="sm">
                                    Account
                                </Button>
                            </Link>
                            <Link href="/client/organization">
                                <Button variant={pathname.startsWith('/client/organization') ? "secondary" : "ghost"} size="sm">
                                    Organization
                                </Button>
                            </Link>
                        </>
                    )}

                    <span className="mx-2 h-4 w-px bg-border" />

                    <Link href="/server">
                        <Button variant="outline" size="sm">
                            Server →
                        </Button>
                    </Link>
                </nav>
            </div>

            <HeaderActions />
        </header>
    )
}
