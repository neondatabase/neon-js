import { useCallback, useMemo } from "react"
import {
    AuthUIProvider,
    type AuthUIProviderProps
} from "../../lib/auth-ui-provider"
import { useTanstackOptions } from "./use-tanstack-options"

export function AuthUIProviderTanstack({
    children,
    authClient,
    hooks: hooksProp,
    mutators: mutatorsProp,
    onSessionChange: onSessionChangeProp,
    ...props
}: AuthUIProviderProps) {
    const {
        hooks: contextHooks,
        mutators: contextMutators,
        onSessionChange,
        optimistic
    } = useTanstackOptions({ authClient })

    const hooks = useMemo(
        () => ({ ...contextHooks, ...hooksProp }),
        [contextHooks, hooksProp]
    )
    const mutators = useMemo(
        () => ({ ...contextMutators, ...mutatorsProp }),
        [contextMutators, mutatorsProp]
    )

    const onSessionChangeCallback = useCallback(async () => {
        await onSessionChange()
        await onSessionChangeProp?.()
    }, [onSessionChangeProp, onSessionChange])

    return (
        <AuthUIProvider
            authClient={authClient}
            hooks={hooks}
            mutators={mutators}
            onSessionChange={onSessionChangeCallback}
            optimistic={optimistic}
            {...props}
        >
            {children}
        </AuthUIProvider>
    )
}
