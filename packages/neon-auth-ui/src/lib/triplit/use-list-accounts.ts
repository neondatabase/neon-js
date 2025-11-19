import type { AuthHooks } from "../../types/auth-hooks"
import { getModelName } from "./model-names"
import { useConditionalQuery } from "./use-conditional-query"
import type { UseTriplitOptionsProps } from "./use-triplit-hooks"
import { useTriplitToken } from "./use-triplit-token"

export function useListAccounts({
    triplit,
    modelNames,
    usePlural,
    isPending
}: UseTriplitOptionsProps): ReturnType<AuthHooks["useListAccounts"]> {
    const modelName = getModelName({
        namespace: "account",
        modelNames,
        usePlural
    })

    const { payload } = useTriplitToken(triplit)

    const { results, error, fetching } = useConditionalQuery(
        triplit,
        payload?.sub && triplit.query(modelName)
    )

    return {
        data: results,
        isPending: isPending || fetching,
        error
    }
}
