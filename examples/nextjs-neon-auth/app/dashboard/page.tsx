"use client"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"

export default function DashboardPage() {
    const { data: session, isPending } = authClient.useSession()
    const router = useRouter()

    useEffect(() => {
        if (!isPending && !session) {
            router.push("/auth/sign-in")
        }
    }, [session, isPending, router])

    if (isPending) {
        return (
            <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-950 dark:border-zinc-700 dark:border-t-zinc-50" />
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</p>
                </div>
            </div>
        )
    }

    if (!session) {
        return null
    }

    return (
        <div className="min-h-[calc(100vh-3.5rem)] bg-zinc-50 dark:bg-zinc-950">
            <div className="container mx-auto px-4 py-8 md:px-6 md:py-12">
                {/* Welcome Section */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 md:text-4xl">
                        Welcome back, {session.user.name || session.user.email}!
                    </h1>
                    <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                        Here&apos;s what&apos;s happening with your account today.
                    </p>
                </div>

                {/* Dashboard Grid */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {/* Account Info Card */}
                    <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                                Account Info
                            </h2>
                            <svg
                                className="h-5 w-5 text-zinc-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                />
                            </svg>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">Email</p>
                                <p className="mt-1 font-medium text-zinc-900 dark:text-zinc-50">
                                    {session.user.email}
                                </p>
                            </div>
                            {session.user.name && (
                                <div>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Name</p>
                                    <p className="mt-1 font-medium text-zinc-900 dark:text-zinc-50">
                                        {session.user.name}
                                    </p>
                                </div>
                            )}
                            <div>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">User ID</p>
                                <p className="mt-1 font-mono text-sm text-zinc-600 dark:text-zinc-400">
                                    {session.user.id}
                                </p>
                            </div>
                        </div>
                        <Link href="/account/settings">
                            <Button variant="outline" className="mt-4 w-full">
                                Manage Account
                            </Button>
                        </Link>
                    </div>

                    {/* Session Card */}
                    <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                                Session
                            </h2>
                            <svg
                                className="h-5 w-5 text-zinc-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                                />
                            </svg>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">Status</p>
                                <div className="mt-1 flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-green-500" />
                                    <p className="font-medium text-zinc-900 dark:text-zinc-50">Active</p>
                                </div>
                            </div>
                            <div>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">Session ID</p>
                                <p className="mt-1 font-mono text-sm text-zinc-600 dark:text-zinc-400">
                                    {session.session.id.substring(0, 24)}...
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">Expires At</p>
                                <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                                    {new Date(session.session.expiresAt).toLocaleDateString("en-US", {
                                        year: "numeric",
                                        month: "long",
                                        day: "numeric",
                                    })}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions Card */}
                    <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                                Quick Actions
                            </h2>
                            <svg
                                className="h-5 w-5 text-zinc-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13 10V3L4 14h7v7l9-11h-7z"
                                />
                            </svg>
                        </div>
                        <div className="space-y-2">
                            <Link href="/account/settings">
                                <Button variant="outline" className="w-full justify-start">
                                    <svg
                                        className="mr-2 h-4 w-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                                        />
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                        />
                                    </svg>
                                    Settings
                                </Button>
                            </Link>
                            <Link href="/account/security">
                                <Button variant="outline" className="w-full justify-start">
                                    <svg
                                        className="mr-2 h-4 w-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                        />
                                    </svg>
                                    Security
                                </Button>
                            </Link>
                            <Link href="/account/profile">
                                <Button variant="outline" className="w-full justify-start">
                                    <svg
                                        className="mr-2 h-4 w-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                    Profile
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Additional Info Section */}
                <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                        Getting Started
                    </h2>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="flex gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                                <svg
                                    className="h-5 w-5 text-zinc-600 dark:text-zinc-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                    />
                                </svg>
                            </div>
                            <div>
                                <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
                                    Documentation
                                </h3>
                                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                                    Learn how to use all features
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                                <svg
                                    className="h-5 w-5 text-zinc-600 dark:text-zinc-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
                                    />
                                </svg>
                            </div>
                            <div>
                                <h3 className="font-medium text-zinc-900 dark:text-zinc-50">Support</h3>
                                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                                    Get help from our team
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                                <svg
                                    className="h-5 w-5 text-zinc-600 dark:text-zinc-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M13 10V3L4 14h7v7l9-11h-7z"
                                    />
                                </svg>
                            </div>
                            <div>
                                <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
                                    API Access
                                </h3>
                                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                                    Integrate with your apps
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

