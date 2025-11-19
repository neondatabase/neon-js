import type {
    FetchResult,
    Models,
    SchemaQuery,
    SubscriptionOptions,
    SubscriptionSignalPayload,
    TriplitClient
} from "@triplit/client"
import type { WorkerClient } from "@triplit/client/worker-client"
import { createStateSubscription } from "@triplit/react"
import { useCallback, useMemo, useState, useSyncExternalStore } from "react"

export function useConditionalQuery<
    M extends Models<M>,
    Q extends SchemaQuery<M>
>(
    client: TriplitClient<M> | WorkerClient<M>,
    query?: Q | false | null | "" | 0,
    options?: Partial<SubscriptionOptions> & { disabled?: boolean }
) {
    const stringifiedQuery =
        !options?.disabled && query && JSON.stringify(query)
    const localOnly = !!options?.localOnly
    const [remoteFulfilled, setRemoteFulfilled] = useState(false)

    const defaultValue: SubscriptionSignalPayload<M, Q> = {
        results: undefined,
        fetching: true,
        fetchingLocal: false,
        fetchingRemote: false,
        error: undefined
    }

    // biome-ignore lint/correctness/useExhaustiveDependencies: prevent infinite re-renders
    const [subscribe, snapshot] = useMemo(
        () =>
            stringifiedQuery
                ? createStateSubscription(client, query, {
                      ...options,
                      onRemoteFulfilled: () => setRemoteFulfilled(true)
                  })
                : [() => () => {}, () => defaultValue],
        [stringifiedQuery, localOnly]
    )

    const getServerSnapshot = useCallback(() => snapshot(), [snapshot])
    const { fetching, ...rest } = useSyncExternalStore(
        subscribe,
        snapshot,
        getServerSnapshot
    )
    return { fetching: fetching && !remoteFulfilled, ...rest }
}

type useConditionalQueryOnePayload<
    M extends Models<M>,
    Q extends SchemaQuery<M>
> = Omit<SubscriptionSignalPayload<M, Q>, "results"> & {
    result: FetchResult<M, Q, "one">
}

export function useConditionalQueryOne<
    M extends Models<M>,
    Q extends SchemaQuery<M>
>(
    client: TriplitClient<M> | WorkerClient<M>,
    query?: Q | false | null | "" | 0,
    options?: Partial<SubscriptionOptions> & { disabled?: boolean }
): useConditionalQueryOnePayload<M, Q> {
    const { fetching, fetchingLocal, fetchingRemote, results, error } =
        useConditionalQuery(
            client,
            query ? ({ ...query, limit: 1 } as Q) : query,
            options
        )

    const result = useMemo(() => {
        return results?.[0] ?? null
    }, [results])

    return { fetching, fetchingLocal, fetchingRemote, result, error }
}
