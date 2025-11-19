import type { InstantReactWebDatabase } from "@instantdb/react"
import type { User } from "better-auth"
import { useMemo } from "react"

import type { Session } from "../../types/auth-client"
import type { AuthHooks } from "../../types/auth-hooks"
import type { AuthMutators } from "../../types/auth-mutators"
import type { Refetch } from "../../types/refetch"
import { getModelName } from "./model-names"
import { useListAccounts } from "./use-list-accounts"
import { useListSessions } from "./use-list-sessions"
import { useSession } from "./use-session"

const namespaces = ["user", "session", "account", "passkey"] as const
type Namespace = (typeof namespaces)[number]

type ModelNames = {
    [key in Namespace]: string
}

export interface UseInstantOptionsProps {
    // biome-ignore lint/suspicious/noExplicitAny: ignore
    db: InstantReactWebDatabase<any>
    modelNames?: Partial<ModelNames>
    usePlural?: boolean
    sessionData?: { user: User; session: Session }
    refetch?: Refetch
    user?: { id: string } | null
    isPending: boolean
}

export function useInstantOptions({
    db,
    usePlural = true,
    modelNames,
    sessionData,
    isPending,
    user
}: UseInstantOptionsProps) {
    const userId = user?.id || sessionData?.user.id

    const hooks = useMemo(() => {
        return {
            useSession: () =>
                useSession({
                    db,
                    modelNames,
                    usePlural,
                    sessionData,
                    isPending
                }),
            useListAccounts: () =>
                useListAccounts({
                    db,
                    modelNames,
                    usePlural,
                    sessionData,
                    isPending
                }),
            useListSessions: () =>
                useListSessions({
                    db,
                    modelNames,
                    usePlural,
                    sessionData,
                    isPending
                })
        } as AuthHooks
    }, [db, modelNames, usePlural, sessionData, isPending])

    const mutators = useMemo(() => {
        return {
            updateUser: async (data) => {
                if (!userId) {
                    throw new Error("Unauthenticated")
                }

                const modelName = getModelName({
                    namespace: "user",
                    modelNames,
                    usePlural
                })

                db.transact([
                    db.tx[modelName][userId].update({
                        ...data,
                        updatedAt: Date.now()
                    })
                ])
            }
        } as AuthMutators
    }, [db, userId, modelNames, usePlural])

    return {
        hooks,
        mutators
    }
}
