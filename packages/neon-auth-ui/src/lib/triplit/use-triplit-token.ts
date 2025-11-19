import type { TriplitClient } from "@triplit/client"
import { useConnectionStatus } from "@triplit/react"
import { useMemo } from "react"

export function useTriplitToken(triplit: TriplitClient) {
    const connectionStatus = useConnectionStatus(triplit)

    // biome-ignore lint/correctness/useExhaustiveDependencies: update when connection status changes
    const payload = useMemo(
        () =>
            triplit.token
                ? (decodeJWT(triplit.token) as Record<string, unknown> & {
                      exp: number
                      iat: number
                      sub?: string
                      email?: string
                      name?: string
                  })
                : undefined,
        [connectionStatus]
    )

    return { token: payload && triplit.token, payload }
}

function decodeJWT(token: string) {
    try {
        const base64Url = token.split(".")[1]
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split("")
                .map((char) => {
                    return `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`
                })
                .join("")
        )

        return JSON.parse(jsonPayload)
    } catch (error) {
        console.error("Failed to decode JWT:", error)
        return null
    }
}
