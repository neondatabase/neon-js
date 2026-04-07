"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { authClient } from "@/lib/auth/client"

export default function DashboardPage() {
    const { data: session, isPending } = authClient.useSession()
    const router = useRouter()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (!isPending && !session) {
            router.push("/auth/sign-in")
        }
    }, [session, isPending, router])

    if (isPending) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-foreground" />
                    <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
            </div>
        )
    }

    if (!session) {
        return null
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="w-full max-w-md px-6">
                <div className="rounded-xl border bg-card p-8 shadow-sm">
                    <div className="mb-6 flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                            {(session.user.name?.[0] || session.user.email?.[0] || "?").toUpperCase()}
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-foreground">
                                Welcome!
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                You&apos;re signed in
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="rounded-lg bg-muted/50 p-4">
                            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                Email
                            </p>
                            <p className="mt-1 font-medium text-foreground">
                                {session.user.email}
                            </p>
                        </div>

                        {session.user.name && (
                            <div className="rounded-lg bg-muted/50 p-4">
                                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    Name
                                </p>
                                <p className="mt-1 font-medium text-foreground">
                                    {session.user.name}
                                </p>
                            </div>
                        )}

                        <div className="rounded-lg bg-muted/50 p-4">
                            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                User ID
                            </p>
                            <p className="mt-1 font-mono text-sm text-muted-foreground">
                                {session.user.id}
                            </p>
                        </div>

                        <div className="rounded-lg bg-muted/50 p-4">
                            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                Session expires
                            </p>
                            <p className="mt-1 text-sm text-foreground">
                                {mounted ? new Date(session.session.expiresAt).toLocaleString() : "\u00A0"}
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 flex flex-col gap-3">
                        <button
                            onClick={async () => {
                                await authClient.signOut()
                                router.push("/")
                            }}
                            className="flex h-10 w-full items-center justify-center rounded-lg border border-border bg-card text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                            Sign Out
                        </button>
                        <Link
                            href="/"
                            className="text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                            Back to home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
