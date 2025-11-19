import type { Session } from "better-auth"
import { useMemo } from "react"
import type { AuthHooks } from "../../types/auth-hooks"
import { getModelName } from "./model-names"
import type { UseInstantOptionsProps } from "./use-instant-options"

export function useListSessions({
    db,
    modelNames,
    usePlural,
    isPending
}: UseInstantOptionsProps): ReturnType<AuthHooks["useListSessions"]> {
    const { user: authUser, isLoading: authLoading } = db.useAuth()

    const modelName = getModelName({
        namespace: "session",
        modelNames,
        usePlural
    })

    const now = useMemo(() => Date.now(), [])

    const { data, isLoading } = db.useQuery(
        authUser
            ? {
                  [modelName]: {
                      $: {
                          where: {
                              userId: authUser?.id,
                              expiresAt: { $gte: now }
                          }
                      }
                  }
              }
            : null
    )

    const sessions = useMemo(() => {
        if (data?.[modelName]) {
            return data[modelName].map((session) => ({
                ...session,
                expiresAt: new Date(session.expiresAt as string),
                createdAt: new Date(session.createdAt as string),
                updatedAt: new Date(session.updatedAt as string)
            })) as Session[]
        }
    }, [data, modelName])

    return {
        data: sessions,
        isPending: !sessions && (isPending || authLoading || isLoading)
    }
}
