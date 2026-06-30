"use client"

import { NeonAuthUIProvider } from "@neondatabase/auth-ui"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"

import { authClient } from "@/lib/auth/client"

type NeonAuthUIProviderAuthClient = Parameters<
    typeof NeonAuthUIProvider
>[0]["authClient"]

export function Providers({ children }: { children: ReactNode }) {
    const router = useRouter()

    return (
        <NeonAuthUIProvider
            authClient={authClient as NeonAuthUIProviderAuthClient}
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
    )
}