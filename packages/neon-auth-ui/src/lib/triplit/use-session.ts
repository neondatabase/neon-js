import type { User } from "../../types/auth-client"
import type { AuthHooks } from "../../types/auth-hooks"
import { getModelName } from "./model-names"
import { useConditionalQueryOne } from "./use-conditional-query"
import type { UseTriplitOptionsProps } from "./use-triplit-hooks"
import { useTriplitToken } from "./use-triplit-token"

export function useSession({
    triplit,
    sessionData,
    isPending,
    refetch,
    usePlural,
    modelNames
}: UseTriplitOptionsProps): ReturnType<AuthHooks["useSession"]> {
    const modelName = getModelName({
        namespace: "user",
        modelNames,
        usePlural
    })

    const { payload } = useTriplitToken(triplit)

    const { result: user, error } = useConditionalQueryOne(
        triplit,
        payload?.sub && triplit.query(modelName)
    )

    return {
        data: sessionData
            ? {
                  session: sessionData.session,
                  user: (sessionData?.user.id === user?.id
                      ? user
                      : sessionData.user) as User
              }
            : null,
        error,
        isPending: isPending,
        refetch: refetch || (() => {})
    }
}
