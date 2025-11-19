import { useEffect, useState, useCallback } from "react"
import type { AuthClient, AuthError, Session, User } from "@neondatabase/neon-auth"

export function useSession(authClient: AuthClient) {
  const [data, setData] = useState<{ session: Session | null; user: User | null } | null>(null)
  const [isPending, setIsPending] = useState(true)
  const [error, setError] = useState<AuthError | null>(null)

  const refetch = useCallback(async () => {
    setIsPending(true)
    const { data: sessionData, error: sessionError } = await authClient.getSession()

    if (sessionError) {
      setError(sessionError as AuthError)
      setData(null)
    } else {
      setError(null)
      setData({
        session: sessionData.session,
        user: sessionData.session?.user ?? null,
      })
    }
    setIsPending(false)
  }, [authClient])

  useEffect(() => {
    refetch()

    const { data: subscriptionData } = authClient.onAuthStateChange(
      (_event, session) => {
        setData({
          session,
          user: session?.user ?? null,
        })
      }
    )

    return () => {
      subscriptionData?.subscription?.unsubscribe?.()
    }
  }, [authClient, refetch])

  return {
    data,
    isPending,
    error,
    refetch,
  }
}
