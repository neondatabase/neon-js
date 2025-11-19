import type { BetterFetchError } from "@better-fetch/fetch"
import type { Account } from "better-auth"
import { useMemo } from "react"
import type { AuthHooks } from "../../types/auth-hooks"
import { getModelName } from "./model-names"
import type { UseInstantOptionsProps } from "./use-instant-options"

export function useListAccounts({
    db,
    modelNames,
    usePlural,
    isPending
}: UseInstantOptionsProps): ReturnType<AuthHooks["useListAccounts"]> {
    const { user: authUser, isLoading: authLoading } = db.useAuth()

    const modelName = getModelName({
        namespace: "account",
        modelNames,
        usePlural
    })

    const { data, isLoading, error } = db.useQuery(
        authUser
            ? { [modelName]: { $: { where: { userId: authUser?.id } } } }
            : null
    )

    const accounts = useMemo(
        () => data?.[modelName] as Account[],
        [data, modelName]
    )

    return {
        data: accounts,
        isPending: !accounts && (isPending || authLoading || isLoading),
        error: (error as BetterFetchError) || null
    }
}
