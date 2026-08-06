"use client"

import { NeonAuthUIProvider } from "@neondatabase/auth-ui"
import Link from "next/link"
import { ThemeProvider } from "next-themes"
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"

import { authClient } from "@/lib/auth/client"

export function Providers({ children }: { children: ReactNode }) {
    const router = useRouter()

    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <NeonAuthUIProvider
            authClient={authClient}
            navigate={router.push}
            replace={router.replace}
            onSessionChange={() => {
                router.refresh()
            }}
            emailOTP
            emailVerification
            social={{
                providers: ["google"]
            }}
            redirectTo="/dashboard"
            Link={Link}
            organization
            credentials={{
                forgotPassword: true,
            }}
            signUp={{
                fields: ['name'],
            }}
        >
            {children}
        </NeonAuthUIProvider>
        </ThemeProvider>
    )
}
