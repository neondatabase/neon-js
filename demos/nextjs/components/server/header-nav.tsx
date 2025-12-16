"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"

export function ServerHeaderNav({ isLoggedIn }: { isLoggedIn: boolean }) {
    const pathname = usePathname()

    return (
        <nav className="flex items-center gap-1">
            <Link href="/server">
                <Button variant={pathname === '/server' ? "secondary" : "ghost"} size="sm">
                    Home
                </Button>
            </Link>
            <Link href="/server/auth/sign-in">
                <Button variant={pathname.startsWith('/server/auth') ? "secondary" : "ghost"} size="sm">
                    Auth
                </Button>
            </Link>
            {isLoggedIn && (
                <>
                    <Link href="/server/account">
                        <Button variant={pathname.startsWith('/server/account') ? "secondary" : "ghost"} size="sm">
                            Account
                        </Button>
                    </Link>
                    <Link href="/server/organization">
                        <Button variant={pathname.startsWith('/server/organization') ? "secondary" : "ghost"} size="sm">
                            Organization
                        </Button>
                    </Link>
                    <Link href="/server/admin">
                        <Button variant={pathname.startsWith('/server/admin') ? "secondary" : "ghost"} size="sm">
                            Admin
                        </Button>
                    </Link>
                </>
            )}

            <span className="mx-2 h-4 w-px bg-border" />

            <Link href="/client">
                <Button variant="outline" size="sm">
                    Client →
                </Button>
            </Link>
        </nav>
    )
}

