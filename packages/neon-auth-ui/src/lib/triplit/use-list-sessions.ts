import type { Session } from "better-auth"
import type { AuthHooks } from "../../types/auth-hooks"
import { getModelName } from "./model-names"
import { useConditionalQuery } from "./use-conditional-query"
import type { UseTriplitOptionsProps } from "./use-triplit-hooks"
import { useTriplitToken } from "./use-triplit-token"

export function useListSessions({
    triplit,
    modelNames,
    usePlural,
    isPending
}: UseTriplitOptionsProps): ReturnType<AuthHooks["useListSessions"]> {
    const modelName = getModelName({
        namespace: "session",
        modelNames,
        usePlural
    })

    const { payload } = useTriplitToken(triplit)

    const {
        results: sessions,
        error,
        fetching
    } = useConditionalQuery(triplit, payload?.sub && triplit.query(modelName))

    return {
        data: sessions as Session[] | undefined,
        isPending: isPending || fetching,
        error
    }
}
