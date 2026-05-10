"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"

const TEST_ROUTES = [
    { label: "Sign In", path: "/auth/sign-in" },
    { label: "Sign Up", path: "/auth/sign-up" },
    { label: "Forgot Password", path: "/auth/forgot-password" },
] as const

export default function IframeTestPage() {
    const [iframeSrc, setIframeSrc] = useState<string>("/auth/sign-in")

    return (
        <main className="container mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
            <div className="mb-6">
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                    SSO in iframe Test
                </h1>
                <p className="mt-2 text-muted-foreground">
                    This page embeds the auth flow in an iframe to test SSO functionality
                    inside a Next.js app.
                </p>

                <div className="mt-5 flex gap-4 rounded-lg border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-4">
                    <span className="text-2xl leading-none">✨</span>
                    <div>
                        <p className="text-sm font-semibold text-foreground">
                            <a
                                href="https://www.npmjs.com/package/@neondatabase/auth"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                            >
                                @neondatabase/auth
                            </a>{" "}
                            supports OAuth flows from within iframes
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            Unlike many auth libraries that break when embedded, Neon Auth
                            handles OAuth popups correctly even when your app runs inside an
                            iframe — perfect for embedded apps, widgets, and multi-tenant
                            platforms. The SDK detects the iframe context and automatically
                            opens the OAuth provider in a popup, then completes the session
                            in the iframe via{" "}
                            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                                postMessage
                            </code>
                            .
                        </p>
                    </div>
                </div>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="text-sm text-muted-foreground">Test Route:</span>
                {TEST_ROUTES.map((route) => (
                    <Button
                        key={route.path}
                        size="sm"
                        variant={iframeSrc === route.path ? "default" : "outline"}
                        onClick={() => setIframeSrc(route.path)}
                    >
                        {route.label}
                    </Button>
                ))}
            </div>

            <div className="overflow-hidden rounded-lg border bg-card">
                <div className="border-b bg-muted px-4 py-3">
                    <span className="font-mono text-sm text-muted-foreground">
                        iframe src: {iframeSrc}
                    </span>
                </div>
                <iframe
                    key={iframeSrc}
                    src={iframeSrc}
                    title="Auth iframe test"
                    className="block h-[600px] w-full border-0"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                />
            </div>

            <div className="mt-6 rounded-lg border bg-muted/50 p-4">
                <h3 className="mb-3 text-base font-semibold text-foreground">
                    What to test:
                </h3>
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                    <li>Click the Google (or any social) SSO button inside the iframe</li>
                    <li>Verify the OAuth popup window opens correctly</li>
                    <li>
                        Complete the SSO flow in the popup and confirm the session is
                        established back inside the iframe
                    </li>
                    <li>
                        Check the browser console for any{" "}
                        <code className="rounded bg-muted px-1 font-mono text-xs">
                            X-Frame-Options
                        </code>{" "}
                        / CSP errors (there should be none)
                    </li>
                    <li>
                        Email/password and magic-link flows should also work normally
                        without any popup
                    </li>
                </ul>
            </div>
        </main>
    )
}
