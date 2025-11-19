type MutateFn<T = Record<string, unknown>> = (
    params: T
) => Promise<unknown> | Promise<void>

export interface AuthMutators {
    updateUser: MutateFn<{ data?: Record<string, unknown>; email?: string; password?: string }>
    unlinkIdentity: MutateFn<{ identity_id: string }>
}
