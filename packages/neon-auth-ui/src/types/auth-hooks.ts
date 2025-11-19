import type { AuthError, Identity, Session, User } from "@neondatabase/neon-auth"
import type { Refetch } from "./refetch"

type AuthHook<T> = {
    isPending: boolean
    data?: T | null
    error?: AuthError | null
    refetch?: Refetch
}

export type AuthHooks = {
    useSession: () => AuthHook<{ session: Session | null; user: User | null }>
    useListIdentities: () => AuthHook<Identity[]>
}
